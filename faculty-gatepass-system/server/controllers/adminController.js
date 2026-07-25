const { notify } = require('../services/notificationService');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function listUsers(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.employee_id, u.email, u.phone, u.role, u.status, d.department_name
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { name, employeeId, email, password, phone, departmentId, role } = req.body;
    if (!name || !employeeId || !email || !password || !role) {
      return res.status(400).json({ error: 'name, employeeId, email, password and role are required.' });
    }
    const validRoles = ['faculty', 'hod', 'dean', 'student', 'registrar', 'security', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (name, employee_id, email, password_hash, phone, department_id, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, employeeId, email, hash, phone || null, departmentId || null, role]
    );
    res.status(201).json({ message: 'User created.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A user with that employee ID or email already exists.' });
    }
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { name, phone, departmentId, role, status } = req.body;
    const [result] = await pool.query(
      `UPDATE users SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         department_id = COALESCE(?, department_id),
         role = COALESCE(?, role),
         status = COALESCE(?, status)
       WHERE id = ?`,
      [name ?? null, phone ?? null, departmentId ?? null, role ?? null, status ?? null, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User updated.' });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const [result] = await pool.query(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User deleted.' });
  } catch (err) {
    next(err);
  }
}

async function listDepartments(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT d.id, d.department_name, d.dept_code, u.name AS hod_name
       FROM departments d LEFT JOIN users u ON u.id = d.hod_id
       ORDER BY d.department_name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function reports(req, res, next) {
  try {
    const [byStatus] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM gate_passes GROUP BY status`
    );
    const [byDept] = await pool.query(
      `SELECT d.department_name, COUNT(*) AS count
       FROM gate_passes gp JOIN departments d ON d.id = gp.department_id
       GROUP BY d.department_name`
    );
    const [[avgApproval]] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(MINUTE, gp.created_at, reg.created_at)) AS avg_minutes
       FROM gate_passes gp
       JOIN approval_history reg ON reg.gatepass_id = gp.id AND reg.role = 'Registrar' AND reg.decision = 'Approved'`
    );
    const [recent] = await pool.query(
      `SELECT gp.pass_code, u.name AS faculty_name, d.department_name, gp.status, gp.created_at
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       ORDER BY gp.created_at DESC LIMIT 20`
    );
    res.json({
      byStatus,
      byDept,
      avgApprovalMinutes: avgApproval.avg_minutes ? Math.round(avgApproval.avg_minutes) : null,
      recent,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, createUser, updateUser, deleteUser, listDepartments, reports };
