const { notify } = require('../services/notificationService');
const { pool } = require('../config/db');
const { generatePassQr } = require('../services/qrService');
const { generatePassPdf } = require('../services/pdfService');

async function nextPassCode(conn) {
  const [rows] = await conn.query(
    `SELECT MAX(CAST(SUBSTRING(pass_code, 4) AS UNSIGNED)) AS max_num FROM gate_passes`
  );
  const next = (rows[0].max_num || 1000) + 1;
  return `GP-${String(next).padStart(4, '0')}`;
}

async function dashboard(req, res, next) {
  try {
    const facultyId = req.user.id;

    const [[totals]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status IN ('Pending HOD','Pending Dean','Pending Registrar')) AS pending,
         SUM(status IN ('Approved','Completed')) AS approved
       FROM gate_passes
       WHERE faculty_id = ?`,
      [facultyId]
    );

    const [recent] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name, u.employee_id, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.faculty_id = ?
       ORDER BY gp.created_at DESC
       LIMIT 10`,
      [facultyId]
    );

    res.json({ totals, recent });
  } catch (err) {
    next(err);
  }
}

async function createPass(req, res, next) {
  try {
    const { purpose, destination, date, outTime, expectedReturn, remarks } = req.body;

    if (!purpose || !date || !outTime || !expectedReturn) {
      return res.status(400).json({
        error: 'purpose, date, outTime and expectedReturn are required.'
      });
    }

    if (!req.user.departmentId) {
      return res.status(400).json({
        error: 'Your account must be assigned to a department before you can apply.'
      });
    }

    const conn = await pool.getConnection();

    await conn.beginTransaction();

    // Generate new pass code
    const passCode = await nextPassCode(conn);

    let initialStatus;
    switch (req.user.role) {
      case 'faculty':
        initialStatus = 'Pending HOD';
        break;
      case 'hod':
        initialStatus = 'Pending Dean';
        break;
      case 'dean':
        initialStatus = 'Pending Registrar';
        break;
      case 'registrar':
        initialStatus = 'Approved';
        break;
      default:
        initialStatus = 'Pending HOD';
    }

    // Insert gate pass
    const [result] = await conn.query(
      `INSERT INTO gate_passes
         (pass_code, faculty_id, department_id, purpose, destination,
          pass_date, out_time, expected_return, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        passCode,
        req.user.id,
        req.user.departmentId,
        purpose,
        destination || null,
        date,
        outTime,
        expectedReturn,
        initialStatus
      ]
    );

    const pass = {
      pass_code: passCode,
      faculty_name: req.user.name,
      employee_id: req.user.employeeId,
      department_name: '',
      purpose,
      pass_date: date,
      out_time: outTime,
      expected_return: expectedReturn,
      status: initialStatus,
    };
    const qrPath = await generatePassQr(pass);
    const pdfPath = await generatePassPdf({ ...pass, qr_code_path: qrPath });
    await conn.query(
      `UPDATE gate_passes SET qr_code_path = ?, pdf_path = ? WHERE id = ?`,
      [qrPath, pdfPath, result.insertId]
    );

    // Add approval history
    await conn.query(
      `INSERT INTO approval_history
         (gatepass_id, approved_by, role, decision, remarks)
       VALUES (?, ?, ?, 'Submitted', ?)`,
      [result.insertId, req.user.id, req.user.role, remarks || null]
    );

    const nextAuthority = {
      'Pending HOD': { role: 'hod', label: 'HOD' },
      'Pending Dean': { role: 'dean', label: 'Dean' },
      'Pending Registrar': { role: 'registrar', label: 'Registrar' },
    }[initialStatus];
    const [authorityRows] = nextAuthority
      ? await conn.query(
        `SELECT email, name FROM users
         WHERE role = ? AND status = 'active'
           AND (role = 'registrar' OR department_id = ?)
         LIMIT 1`,
        [nextAuthority.role, req.user.departmentId]
      )
      : [[]];

    if (authorityRows.length) {
      const authority = authorityRows[0];

      // Send email in background (non-blocking)
      notify(
        authority.email,
        `New Gate Pass Request - ${passCode}`,
        `
          <p>Hello <b>${authority.name}</b>,</p>

          <p>A new gate pass request has been submitted and is waiting for ${nextAuthority.label} approval.</p>

          <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
            <tr><td><b>Pass Code</b></td><td>${passCode}</td></tr>
            <tr><td><b>Faculty</b></td><td>${req.user.name}</td></tr>
            <tr><td><b>Purpose</b></td><td>${purpose}</td></tr>
            <tr><td><b>Date</b></td><td>${date}</td></tr>
            <tr><td><b>Out Time</b></td><td>${outTime}</td></tr>
            <tr><td><b>Expected Return</b></td><td>${expectedReturn}</td></tr>
          </table>

          <p>Please log in to the ${nextAuthority.label} dashboard to review and approve the request.</p>

          <p><b>ExitLine Gate Pass System</b></p>
        `
      ).catch(err => {
        console.error('Email notification failed:', err.message);
      });
    }
    // =============================================================

    await conn.commit();

    const message =
      req.user.role === 'student'
        ? `Student leave ${passCode} submitted to HOD for approval.`
        : `Leave request ${passCode} submitted to HOD for approval.`;

    res.status(201).json({
      message,
      id: result.insertId,
      passCode
    });

  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function history(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       WHERE gp.faculty_id = ?
       ORDER BY gp.created_at DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function passDetail(req, res, next) {
  try {
    const [[pass]] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.id = ? AND gp.faculty_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!pass) {
      return res.status(404).json({ error: 'Pass not found.' });
    }

    const [history] = await pool.query(
      `SELECT ah.*, u.name AS actor_name
       FROM approval_history ah
       JOIN users u ON u.id = ah.approved_by
       WHERE ah.gatepass_id = ?
       ORDER BY ah.created_at ASC`,
      [pass.id]
    );

    res.json({ ...pass, history });

  } catch (err) {
    next(err);
  }
}

async function profile(req, res, next) {
  try {
    const [[user]] = await pool.query(
      `SELECT u.id, u.name, u.employee_id, u.email, u.phone, u.role,
              d.department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    res.json(user);

  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard,
  createPass,
  history,
  passDetail,
  profile
};