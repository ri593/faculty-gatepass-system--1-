const { notifyMany } = require('../services/notificationService');
const { pool } = require('../config/db');
const { generatePassQr } = require('../services/qrService');
const { generatePassPdf } = require('../services/pdfService');

async function pending(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name, u.email AS faculty_email, u.employee_id, u.role AS requester_role, d.department_name
       FROM gate_passes gp JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.department_id = ? AND gp.status = 'Pending HOD'
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
       FROM gate_passes gp JOIN users u ON u.id = gp.faculty_id
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
    const passId = req.params.id;

    const [[pass]] = await conn.query(
      `SELECT gp.*, u.name AS faculty_name, u.email AS faculty_email, u.employee_id, u.role AS requester_role, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.id = ? AND gp.department_id = ? AND gp.status = 'Pending HOD'`,
      [passId, req.user.departmentId]
    );
    if (!pass) {
      return res.status(404).json({ error: 'Pass not found, not in your department, or already decided.' });
    }

    await conn.beginTransaction();
    const isStudent = pass.requester_role === 'student';
    const newStatus = decision === 'Approved'
      ? (isStudent ? 'Approved' : 'Pending Dean')
      : 'Rejected';
    let qrPath = null;
    let pdfPath = null;
    if (decision === 'Approved' && isStudent) {
      qrPath = await generatePassQr(pass);
      pdfPath = await generatePassPdf({ ...pass, qr_code_path: qrPath, status: 'Approved' });
    }
    await conn.query(
      `UPDATE gate_passes SET status = ?, qr_code_path = COALESCE(?, qr_code_path), pdf_path = COALESCE(?, pdf_path) WHERE id = ?`,
      [newStatus, qrPath, pdfPath, passId]
    );
    await conn.query(
      `INSERT INTO approval_history (gatepass_id, approved_by, role, decision, remarks)
       VALUES (?, ?, 'HOD', ?, ?)`,
      [passId, req.user.id, decision, remarks || (isStudent && decision === 'Approved' ? 'Student leave approved by HOD. QR pass generated.' : null)]
    );
    await conn.commit();

    try {
      const [deans] = await pool.query(
        `SELECT email FROM users
         WHERE role = 'dean' AND department_id = ? AND status = 'active'
         LIMIT 1`,
        [pass.department_id]
      );
      const recipients = decision === 'Approved'
        ? [pass.faculty_email, ...deans.map(dean => dean.email)]
        : [pass.faculty_email];
      const nextStep = decision === 'Approved' && !isStudent
        ? 'The request is now waiting for Dean approval.'
        : 'Please log in to the faculty dashboard to view the decision.';
      notifyMany(
        recipients,
        `Gate Pass ${decision} by HOD - ${pass.pass_code}`,
        `
          <p>Hello,</p>
          <p>The gate pass request below has been <b>${decision.toLowerCase()}</b> by the HOD.</p>
          <p><b>Pass Code:</b> ${pass.pass_code}<br>
          <b>Faculty:</b> ${pass.faculty_name}<br>
          <b>Purpose:</b> ${pass.purpose}<br>
          <b>Date:</b> ${pass.pass_date}<br>
          <b>Remarks:</b> ${remarks || 'None'}</p>
          <p>${nextStep}</p>
        `
      ).catch(err => console.error('HOD email notification failed:', err.message));
    } catch (err) {
      console.error('HOD email recipient lookup failed:', err.message);
    }

    res.json({ message: `Pass ${pass.pass_code} ${decision.toLowerCase()} by HOD.`, status: newStatus, qrCodePath: qrPath, pdfPath });
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
