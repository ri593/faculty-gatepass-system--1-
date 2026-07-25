const { notify } = require('../services/notificationService');
const { pool } = require('../config/db');

async function activePasses(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name, u.employee_id, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.status = 'Approved'
       ORDER BY gp.pass_date ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function log(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.actual_exit IS NOT NULL OR gp.actual_return IS NOT NULL
       ORDER BY gp.actual_exit DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * Looks a pass up by its pass_code (what the QR payload encodes) and reports
 * whether it's valid for gate movement right now, without mutating anything.
 * Used by the "scan" step before committing to an exit/entry action.
 */
async function scan(req, res, next) {
  try {
    const { passCode } = req.body;
    if (!passCode) return res.status(400).json({ error: 'passCode is required.' });

    const [[pass]] = await pool.query(
      `SELECT gp.*, u.name AS faculty_name, u.employee_id, d.department_name
       FROM gate_passes gp
       JOIN users u ON u.id = gp.faculty_id
       JOIN departments d ON d.id = gp.department_id
       WHERE gp.pass_code = ?`,
      [passCode]
    );
    if (!pass) return res.status(404).json({ error: `No pass found with code ${passCode}.` });

    let nextAction = null;
    if (pass.status === 'Approved' && !pass.actual_exit) nextAction = 'exit';
    else if (pass.status === 'Approved' && pass.actual_exit && !pass.actual_return) nextAction = 'entry';

    res.json({ pass, nextAction, valid: pass.status === 'Approved' });
  } catch (err) {
    next(err);
  }
}

async function recordExit(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { passCode } = req.body;
    const [[pass]] = await conn.query(
      `SELECT * FROM gate_passes WHERE pass_code = ? AND status = 'Approved'`,
      [passCode]
    );
    if (!pass) { return res.status(404).json({ error: 'Pass not found or not approved.' }); }
    if (pass.actual_exit) { return res.status(409).json({ error: 'Exit already recorded for this pass.' }); }

    await conn.beginTransaction();
    await conn.query(`UPDATE gate_passes SET actual_exit = NOW() WHERE id = ?`, [pass.id]);
    await conn.query(
      `INSERT INTO approval_history (gatepass_id, approved_by, role, decision, remarks)
       VALUES (?, ?, 'Security', 'Exit Recorded', NULL)`,
      [pass.id, req.user.id]
    );
    await conn.commit();
    res.json({ message: `Exit recorded for ${passCode}.` });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function recordEntry(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { passCode } = req.body;
    const [[pass]] = await conn.query(
      `SELECT * FROM gate_passes WHERE pass_code = ? AND status = 'Approved'`,
      [passCode]
    );
    if (!pass) { return res.status(404).json({ error: 'Pass not found or not approved.' }); }
    if (!pass.actual_exit) { return res.status(409).json({ error: 'Exit has not been recorded yet.' }); }
    if (pass.actual_return) { return res.status(409).json({ error: 'Entry already recorded for this pass.' }); }

    await conn.beginTransaction();
    await conn.query(`UPDATE gate_passes SET actual_return = NOW(), status = 'Completed' WHERE id = ?`, [pass.id]);
    await conn.query(
      `INSERT INTO approval_history (gatepass_id, approved_by, role, decision, remarks)
       VALUES (?, ?, 'Security', 'Entry Recorded', NULL)`,
      [pass.id, req.user.id]
    );
    await conn.commit();
    res.json({ message: `Entry recorded for ${passCode}. Gate cycle complete.` });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = { activePasses, log, scan, recordExit, recordEntry };
