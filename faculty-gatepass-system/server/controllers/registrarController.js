const { notifyMany } = require('../services/notificationService');
const { pool } = require('../config/db');
const { generatePassQr } = require('../services/qrService');
const { generatePassPdf } = require('../services/pdfService');

async function stats(req, res, next) {
  try {
    const [[totals]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'Pending Registrar') AS pending,
        SUM(status = 'Approved')          AS approved,
        SUM(status = 'Completed')         AS completed,
        SUM(status = 'Rejected')          AS rejected,
        SUM(DATE(created_at) = CURDATE()) AS today
      FROM gate_passes
    `);
    const [recent] = await pool.query(`
      SELECT gp.*, u.name AS faculty_name, d.department_name
      FROM gate_passes gp
      JOIN users u ON u.id = gp.faculty_id
      JOIN departments d ON d.id = gp.department_id
      ORDER BY gp.created_at DESC LIMIT 5
    `);
    res.json({ totals, recent });
  } catch (err) {
    next(err);
  }
}

async function pending(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name, u.email AS faculty_email, u.employee_id, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.status = 'Pending Registrar'
       ORDER BY gp.created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function allPasses(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       ORDER BY gp.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function approve(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const passId = req.params.id;
    const { remarks } = req.body;

    const [[pass]] = await conn.query(
      `SELECT gp.*, u.name AS faculty_name, u.email AS faculty_email, u.employee_id, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.id = ? AND gp.status = 'Pending Registrar'`,
      [passId]
    );
    if (!pass) {
      return res.status(404).json({ error: 'Pass not found or not awaiting registrar approval.' });
    }

    // Generate QR + PDF before committing the status change so we never mark
    // a pass Approved without an actual pass artifact backing it.
    const qrPath = await generatePassQr(pass);
    const pdfPath = await generatePassPdf({ ...pass, qr_code_path: qrPath, status: 'Approved' });

    await conn.beginTransaction();
    await conn.query(
      `UPDATE gate_passes SET status = 'Approved', qr_code_path = ?, pdf_path = ? WHERE id = ?`,
      [qrPath, pdfPath, passId]
    );
    await conn.query(
      `INSERT INTO approval_history (gatepass_id, approved_by, role, decision, remarks)
       VALUES (?, ?, 'Registrar', 'Approved', ?)`,
      [passId, req.user.id, remarks || 'QR pass generated.']
    );
    await conn.commit();

    notifyMany(
      [pass.faculty_email],
      `Gate Pass Approved by Registrar - ${pass.pass_code}`,
      `
        <p>Hello ${pass.faculty_name},</p>
        <p>Your gate pass request has been <b>approved by the Registrar</b>.</p>
        <p><b>Pass Code:</b> ${pass.pass_code}<br>
        <b>Purpose:</b> ${pass.purpose}<br>
        <b>Date:</b> ${pass.pass_date}<br>
        <b>Remarks:</b> ${remarks || 'QR pass generated.'}</p>
        <p>Your QR gate pass and PDF are now available in the faculty dashboard.</p>
      `
    ).catch(err => console.error('Registrar email notification failed:', err.message));

    res.json({ message: `Pass ${pass.pass_code} approved. QR gate pass generated.`, qrCodePath: qrPath, pdfPath });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function reject(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const passId = req.params.id;
    const { remarks } = req.body;
    const [[pass]] = await conn.query(
      `SELECT gp.*, u.name AS faculty_name, u.email AS faculty_email
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       WHERE gp.id = ? AND gp.status = 'Pending Registrar'`,
      [passId]
    );
    if (!pass) {
      return res.status(404).json({ error: 'Pass not found or not awaiting registrar approval.' });
    }
    await conn.beginTransaction();
    await conn.query(`UPDATE gate_passes SET status = 'Rejected' WHERE id = ?`, [passId]);
    await conn.query(
      `INSERT INTO approval_history (gatepass_id, approved_by, role, decision, remarks)
       VALUES (?, ?, 'Registrar', 'Rejected', ?)`,
      [passId, req.user.id, remarks || null]
    );
    await conn.commit();

    notifyMany(
      [pass.faculty_email],
      `Gate Pass Rejected by Registrar - ${pass.pass_code}`,
      `
        <p>Hello ${pass.faculty_name},</p>
        <p>Your gate pass request has been <b>rejected by the Registrar</b>.</p>
        <p><b>Pass Code:</b> ${pass.pass_code}<br>
        <b>Purpose:</b> ${pass.purpose}<br>
        <b>Date:</b> ${pass.pass_date}<br>
        <b>Remarks:</b> ${remarks || 'None'}</p>
        <p>Please log in to the faculty dashboard for more details.</p>
      `
    ).catch(err => console.error('Registrar email notification failed:', err.message));

    res.json({ message: `Pass ${pass.pass_code} rejected.` });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = { stats, pending, allPasses, approve, reject };
