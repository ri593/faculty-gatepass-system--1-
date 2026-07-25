const { notify } = require('../services/notificationService');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { signToken } = require('../config/jwt');

const SELF_REGISTER_ROLES = ['faculty', 'hod', 'dean', 'student'];

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [rows] = await pool.query(
      `SELECT u.*, d.department_name, d.dept_code
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.email = ? LIMIT 1`,
      [email]
    );
    const user = rows[0];
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken({
      id: user.id,
      name: user.name,
      role: user.role,
      employeeId: user.employee_id,
      departmentId: user.department_id,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        employeeId: user.employee_id,
        email: user.email,
        role: user.role,
        department: user.department_name,
        deptCode: user.dept_code,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const { name, employeeId, email, password, phone, departmentId, role } = req.body;
    if (!name || !employeeId || !email || !password || !departmentId || !role) {
      return res.status(400).json({ error: 'name, employeeId, email, password, departmentId and role are required.' });
    }
    if (!SELF_REGISTER_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${SELF_REGISTER_ROLES.join(', ')}` });
    }

    const [[department]] = await pool.query('SELECT id FROM departments WHERE id = ?', [departmentId]);
    if (!department) return res.status(400).json({ error: 'Selected department was not found.' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (name, employee_id, email, password_hash, phone, department_id, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, employeeId, email, hash, phone || null, departmentId, role]
    );
    res.status(201).json({ message: 'Account created. You can sign in now.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with that ID or email already exists.' });
    }
    next(err);
  }
}

async function departments(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, department_name, dept_code FROM departments ORDER BY department_name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.employee_id, u.email, u.role, d.department_name, d.dept_code
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// Stateless JWT: "logout" is a client-side token discard. Endpoint kept for API symmetry
// with the spec, and as a hook point if you later move to refresh-token/session storage.
function logout(req, res) {
  res.json({ message: 'Logged out. Discard the token on the client.' });
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    // Always respond the same way whether or not the email exists, to avoid account enumeration.
    if (rows[0]) {
      // In production: generate a reset token, store its hash + expiry, email a reset link.
      console.log(`[forgotPassword] reset requested for user id ${rows[0].id}`);
    }
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, departments, me, logout, forgotPassword };
