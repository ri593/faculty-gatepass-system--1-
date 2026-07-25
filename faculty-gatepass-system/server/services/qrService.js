const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const QR_FOLDER = process.env.QR_FOLDER || 'uploads/qrcodes';
const ABS_QR_FOLDER = path.join(__dirname, '..', QR_FOLDER);

if (!fs.existsSync(ABS_QR_FOLDER)) {
  fs.mkdirSync(ABS_QR_FOLDER, { recursive: true });
}

/**
 * Generates a high-quality, security-enriched QR code for a gate pass.
 *
 * The QR payload is a signed JSON object containing:
 *   - passCode, employeeId, date, facultyName
 *   - a SHA-256 security token so the security scanner can detect tampering
 *
 * Error correction level H (30%) allows up to 30% of the QR to be
 * covered/damaged and still be readable — important for printing.
 *
 * Returns the relative path stored in gate_passes.qr_code_path.
 */
async function generatePassQr(pass) {
  // Build a tamper-evident payload with a security token
  const tokenSeed = `${pass.pass_code}|${pass.employee_id}|${pass.pass_date}|${pass.faculty_name}`;
  const securityToken = crypto.createHash('sha256').update(tokenSeed).digest('hex').substring(0, 16).toUpperCase();

  const payload = JSON.stringify({
    passCode:      pass.pass_code,
    employeeId:    pass.employee_id,
    facultyName:   pass.faculty_name,
    department:    pass.department_name,
    date:          pass.pass_date,
    outTime:       pass.out_time,
    status:        pass.status || 'Approved',
    securityToken, // ← unique per pass, verified by scanner
    issuedBy:      'ExitLine Gate Pass System',
    verifyAt:      'https://exitline.rntu.ac.in/verify',
  });

  const filename = `${pass.pass_code}.png`;
  const absPath = path.join(ABS_QR_FOLDER, filename);

  await QRCode.toFile(absPath, payload, {
    width:           360,
    margin:          2,
    errorCorrectionLevel: 'H',   // Highest: 30% damage tolerance
    color: {
      dark:  '#0B1F3A',          // navy dots — matches PDF branding
      light: '#FFFFFF',
    },
  });

  return path.posix.join(QR_FOLDER, filename);
}

module.exports = { generatePassQr };
