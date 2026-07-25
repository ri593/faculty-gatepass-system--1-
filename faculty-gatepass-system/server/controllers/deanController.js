const { notifyMany } = require('../services/notificationService');
const { pool } = require('../config/db');
const { generatePassQr } = require('../services/qrService');
const { generatePassPdf } = require('../services/pdfService');

async function pending(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name, u.employee_id, u.role AS requester_role, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.status = 'Pending Dean' AND gp.department_id = ?
       ORDER BY gp.created_at ASC`,
      [req.user.departmentId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function history(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name, u.employee_id, u.role AS requester_role
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       WHERE gp.department_id = ?
       ORDER BY gp.created_at DESC`,
      [req.user.departmentId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function decide(req, res, next, decision) {
  const conn = await pool.getConnection();
  try {
    const { remarks } = req.body;
    await conn.beginTransaction();
    const [[pass]] = await conn.query(
      `SELECT gp.*, u.name AS faculty_name, u.email AS faculty_email, u.employee_id, u.role AS requester_role, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.id = ? AND gp.department_id = ? AND gp.status = 'Pending Dean'
       FOR UPDATE`,
      [req.params.id, req.user.departmentId]
    );
    if (!pass) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pass not found or not awaiting Dean approval.' });
    }

    const newStatus = decision === 'Approved' ? 'Pending Registrar' : 'Rejected';

    await conn.query(
      `UPDATE gate_passes SET status = ? WHERE id = ?`,
      [newStatus, pass.id]
    );
    await conn.query(
      `INSERT INTO approval_history (gatepass_id, approved_by, role, decision, remarks)
       VALUES (?, ?, 'Dean', ?, ?)`,
      [pass.id, req.user.id, decision, remarks || null]
    );
    await conn.commit();

    if (decision === 'Approved') {
      try {
        const [registrars] = await pool.query(
          `SELECT email FROM users WHERE role = 'registrar' AND status = 'active'`
        );
        notifyMany(
          [pass.faculty_email, ...registrars.map(registrar => registrar.email)],
          `Gate Pass Approved by Dean - ${pass.pass_code}`,
          `
            <p>Hello ${pass.faculty_name},</p>
            <p>Your gate pass <b>${pass.pass_code}</b> has been <b>approved by the Dean</b>.</p>
            <p>It has now been forwarded to the Registrar for final approval.</p>
            <p><b>Purpose:</b> ${pass.purpose}<br><b>Date:</b> ${pass.pass_date}<br><b>Remarks:</b> ${remarks || 'None'}</p>
          `
        ).catch(err => console.error('Dean email notification failed:', err.message));
      } catch (err) {
        console.error('Dean email recipient lookup failed:', err.message);
      }
    } else {
      notifyMany(
        [pass.faculty_email],
        `Gate Pass Rejected by Dean - ${pass.pass_code}`,
        `
          <p>Hello ${pass.faculty_name},</p>
          <p>Your gate pass <b>${pass.pass_code}</b> has been <b>rejected by the Dean</b>.</p>
          <p><b>Purpose:</b> ${pass.purpose}<br><b>Date:</b> ${pass.pass_date}<br><b>Remarks:</b> ${remarks || 'None'}</p>
        `
      ).catch(err => console.error('Dean email notification failed:', err.message));
    }

    res.json({ message: `Pass ${pass.pass_code} ${decision.toLowerCase()} by Dean.`, status: newStatus });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

const approve = (req, res, next) => decide(req, res, next, 'Approved');
const reject = (req, res, next) => decide(req, res, next, 'Rejected');

module.exports = { pending, history, approve, reject };