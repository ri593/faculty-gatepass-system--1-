const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const PDF_FOLDER = process.env.PDF_FOLDER || 'uploads/passes';
const ABS_PDF_FOLDER = path.join(__dirname, '..', PDF_FOLDER);

if (!fs.existsSync(ABS_PDF_FOLDER)) {
  fs.mkdirSync(ABS_PDF_FOLDER, { recursive: true });
}

/* ─── Colour palette (official university feel) ─── */
const C = {
  navy:       '#0B1F3A',   // deep navy header
  navyLight:  '#1A3558',
  gold:       '#C8A84B',   // gold accent
  goldLight:  '#F0D88A',
  teal:       '#0E7A6E',
  pale:       '#F0F4F8',
  paleBlue:   '#D6E4F0',
  steel:      '#4A6080',
  muted:      '#6B7A8D',
  white:      '#FFFFFF',
  border:     '#B0C4D8',
  red:        '#C0392B',
};

/* ─── Generate a short unique token tied to this pass ─── */
function makeSecurityToken(pass) {
  const seed = `${pass.pass_code}|${pass.employee_id}|${pass.pass_date}|${pass.faculty_name}`;
  return crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16).toUpperCase();
}

/* ─── Draw diagonal watermark text across page ─── */
function drawWatermark(doc, text) {
  doc.save();
  doc.opacity(0.045);
  doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(62);
  // Repeat diagonally across the A4 page
  for (let y = -60; y < 900; y += 130) {
    for (let x = -80; x < 700; x += 300) {
      doc.save();
      doc.translate(x + 110, y + 100);
      doc.rotate(-38);
      doc.text(text, 0, 0);
      doc.restore();
    }
  }
  doc.restore();
  doc.opacity(1);
}

/* ─── Micro guilloche border pattern (security line pattern) ─── */
function drawGuillocheStrip(doc, x, y, width, height, color) {
  doc.save();
  doc.rect(x, y, width, height).clip();
  doc.strokeColor(color).lineWidth(0.3).opacity(0.55);
  const step = 4;
  for (let i = 0; i <= width + height; i += step) {
    doc.moveTo(x + i, y).lineTo(x, y + i).stroke();
    doc.moveTo(x + width - i, y).lineTo(x + width, y + i).stroke();
  }
  doc.restore();
  doc.opacity(1);
}

/* ─── Gear / rosette pattern (like a passport corner ornament) ─── */
function drawRosette(doc, cx, cy, color, size = 20) {
  doc.save();
  doc.opacity(0.18);
  doc.strokeColor(color).lineWidth(0.6);
  for (let a = 0; a < 360; a += 20) {
    const rad = (a * Math.PI) / 180;
    const rad2 = ((a + 10) * Math.PI) / 180;
    doc.moveTo(cx, cy)
       .lineTo(cx + Math.cos(rad) * size, cy + Math.sin(rad) * size)
       .lineTo(cx + Math.cos(rad2) * (size * 0.65), cy + Math.sin(rad2) * (size * 0.65))
       .closePath().stroke();
  }
  doc.restore();
  doc.opacity(1);
}

/* ─── Dotted security micro-pattern strip ─── */
function drawMicroDots(doc, x, y, width, height, color) {
  doc.save();
  doc.opacity(0.12);
  doc.fillColor(color);
  for (let px = x + 4; px < x + width - 4; px += 6) {
    for (let py = y + 2; py < y + height - 2; py += 5) {
      doc.circle(px, py, 0.8).fill();
    }
  }
  doc.restore();
  doc.opacity(1);
}

/* ─── Field box renderer ─── */
function field(doc, label, value, x, y, width, height = 52) {
  // Shadow effect
  doc.roundedRect(x + 2, y + 2, width, height, 4).fill('#D0DCE8').opacity(0.5);
  doc.opacity(1);
  // Box
  doc.roundedRect(x, y, width, height, 4).fill(C.pale);
  // Left accent bar
  doc.roundedRect(x, y, 4, height, 2).fill(C.gold);
  // Label
  doc.fillColor(C.steel).font('Helvetica-Bold').fontSize(7)
     .text(label.toUpperCase(), x + 14, y + 9, { width: width - 20, lineBreak: false });
  // Value
  doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(11)
     .text(String(value ?? '—'), x + 14, y + 24, { width: width - 20, ellipsis: true, lineBreak: false });
}

/**
 * Generates an official-looking, security-hardened PDF gate pass.
 */
function generatePassPdf(pass) {
  return new Promise((resolve, reject) => {
    const filename   = `${pass.pass_code}.pdf`;
    const absPath    = path.join(ABS_PDF_FOLDER, filename);
    const doc        = new PDFDocument({ size: 'A4', margin: 0, info: {
      Title:    `Gate Pass – ${pass.pass_code}`,
      Author:   'ExitLine | Rabindranath Tagore University',
      Subject:  'Authorized Movement Document',
      Keywords: 'gate pass, authorized, university, secure',
    }});
    const stream = fs.createWriteStream(absPath);
    doc.pipe(stream);

    const M  = 40;           // margin
    const PW = 595 - M * 2; // usable page width
    const GAP = 10;

    /* ══════════════════════════════════════════
       1.  FULL-PAGE WATERMARK (behind everything)
    ══════════════════════════════════════════ */
    drawWatermark(doc, 'EXITLINE');

    /* ══════════════════════════════════════════
       2.  HEADER BAND
    ══════════════════════════════════════════ */
    // Dark navy header
    doc.rect(0, 0, 595, 90).fill(C.navy);
    // Gold bottom stripe on header
    doc.rect(0, 85, 595, 5).fill(C.gold);
    // Guilloche pattern inside header
    drawGuillocheStrip(doc, 0, 0, 595, 85, C.gold);
    // Rosettes in corners
    drawRosette(doc, 30, 44, C.gold, 28);
    drawRosette(doc, 565, 44, C.gold, 28);

    // University name
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(15)
       .text('RABINDRANATH TAGORE UNIVERSITY', M, 16, { width: PW, align: 'center' });
    doc.fillColor(C.goldLight).font('Helvetica').fontSize(8.5)
       .text('Established under M.P. Private University Act, 2007  |  NAAC Accredited', M, 36, { width: PW, align: 'center' });
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(9)
       .text('AUTHORIZED MOVEMENT DOCUMENT — FACULTY GATE PASS', M, 55, { width: PW, align: 'center' });
    doc.fillColor(C.goldLight).font('Helvetica').fontSize(7.5)
       .text('This document is electronically generated and carries a unique security signature.', M, 70, { width: PW, align: 'center' });

    /* ══════════════════════════════════════════
       3.  PASS TITLE BAR
    ══════════════════════════════════════════ */
    doc.rect(M, 100, PW, 36).fill(C.navyLight);
    drawMicroDots(doc, M, 100, PW, 36, C.white);
    // Pass title
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(16)
       .text('GATE PASS', M + 14, 110, { continued: true });
    // Pass code in gold
    doc.fillColor(C.gold).fontSize(14)
       .text(`  ${pass.pass_code}`, { continued: false });
    // Status badge on the right
    const statusColor = pass.status === 'Approved' ? '#16A34A' : pass.status === 'Completed' ? C.teal : C.red;
    doc.roundedRect(M + PW - 100, 107, 96, 22, 4).fill(statusColor);
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(9)
       .text(pass.status.toUpperCase(), M + PW - 100, 114, { width: 96, align: 'center' });

    /* ══════════════════════════════════════════
       4.  FIELDS GRID
    ══════════════════════════════════════════ */
    const col = (PW - GAP) / 2;
    let fy = 148;

    field(doc, 'Requester Name',  pass.faculty_name,    M,           fy, col);
    field(doc, 'Employee ID',     pass.employee_id,     M + col + GAP, fy, col);
    fy += 60;
    field(doc, 'Department',      pass.department_name, M,           fy, PW);
    fy += 60;
    field(doc, 'Pass Date',       pass.pass_date,       M,           fy, col);
    field(doc, 'Out Time',        pass.out_time,        M + col + GAP, fy, col);
    fy += 60;
    field(doc, 'Expected Return', pass.expected_return, M,           fy, col);
    field(doc, 'Destination',     pass.destination || 'Not specified', M + col + GAP, fy, col);

    /* ══════════════════════════════════════════
       5.  PURPOSE BOX
    ══════════════════════════════════════════ */
    fy += 64;
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(8.5)
       .text('PURPOSE / TRAVEL DETAILS', M, fy);
    fy += 12;
    doc.roundedRect(M, fy, PW, 58, 4)
       .lineWidth(1).strokeColor(C.gold).fillAndStroke(C.pale, C.gold);
    doc.roundedRect(M, fy, 4, 58, 2).fill(C.gold);
    doc.fillColor(C.navy).font('Helvetica').fontSize(11.5)
       .text(String(pass.purpose || '—'), M + 16, fy + 16, { width: PW - 36, lineBreak: false });

    /* ══════════════════════════════════════════
       6.  SECURITY TOKEN + QR SIDE BY SIDE
    ══════════════════════════════════════════ */
    fy += 72;
    const token = makeSecurityToken(pass);
    const qrSize = 120;
    const leftW  = PW - qrSize - 20;

    // Security signature box
    doc.roundedRect(M, fy, leftW, 48, 4).fill(C.navy);
    drawMicroDots(doc, M, fy, leftW, 48, C.white);
    doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(7.5)
       .text('DIGITAL SECURITY SIGNATURE', M + 12, fy + 8, { width: leftW - 20 });
    doc.fillColor(C.white).font('Helvetica').fontSize(9)
       .text(token, M + 12, fy + 22, { width: leftW - 20, characterSpacing: 2 });
    doc.fillColor(C.muted).fontSize(6.5)
       .text('SHA-256 derived token — verify at security gate scanner', M + 12, fy + 37, { width: leftW - 20 });

    // Valid date strip
    doc.roundedRect(M, fy + 52, leftW, 28, 4).fill(C.paleBlue);
    doc.fillColor(C.steel).font('Helvetica-Bold').fontSize(7)
       .text('VALID FOR DATE', M + 12, fy + 59);
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(11)
       .text(pass.pass_date, M + 12, fy + 69, { width: leftW - 20, lineBreak: false });

    // QR code on the right
    const qrPath = path.join(__dirname, '..', pass.qr_code_path || '');
    const qrX = M + leftW + 20;
    if (pass.qr_code_path && fs.existsSync(qrPath)) {
      // QR border frame
      doc.roundedRect(qrX - 6, fy - 6, qrSize + 12, qrSize + 26, 4)
         .lineWidth(1.5).strokeColor(C.gold).fillAndStroke(C.pale, C.gold);
      doc.image(qrPath, qrX, fy, { width: qrSize, height: qrSize });
      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(7)
         .text('SCAN AT GATE', qrX - 6, fy + qrSize + 8, { width: qrSize + 12, align: 'center' });
    }

    /* ══════════════════════════════════════════
       7.  SIGNATURE LINES
    ══════════════════════════════════════════ */
    fy += qrSize + 30;
    const sigW = (PW - GAP * 2) / 3;
    const sigLabels = ['HOD Signature', 'Dean Signature', 'Security Officer'];
    sigLabels.forEach((lbl, i) => {
      const sx = M + i * (sigW + GAP);
      doc.moveTo(sx + 10, fy + 28).lineTo(sx + sigW - 10, fy + 28)
         .strokeColor(C.border).lineWidth(1).stroke();
      doc.fillColor(C.muted).font('Helvetica').fontSize(7.5)
         .text(lbl, sx, fy + 32, { width: sigW, align: 'center' });
    });

    /* ══════════════════════════════════════════
       8.  FOOTER BAND
    ══════════════════════════════════════════ */
    fy += 56;
    doc.rect(0, fy, 595, 5).fill(C.gold);
    doc.rect(0, fy + 5, 595, 38).fill(C.navy);
    drawGuillocheStrip(doc, 0, fy + 5, 595, 38, C.gold);

    doc.fillColor(C.goldLight).font('Helvetica-Bold').fontSize(7.5)
       .text(
         `Generated by ExitLine Gate Pass System  |  Pass: ${pass.pass_code}  |  Token: ${token}  |  For official use only`,
         M, fy + 14, { width: PW, align: 'center' }
       );
    doc.fillColor(C.muted).font('Helvetica').fontSize(6.5)
       .text(
         'This document is electronically generated. Any alteration or tampering renders it invalid. Present QR to Security before exit and upon return.',
         M, fy + 26, { width: PW, align: 'center' }
       );

    /* ══════════════════════════════════════════
       9.  CORNER ROSETTES (decorative security)
    ══════════════════════════════════════════ */
    drawRosette(doc, M + 16, 115, C.gold, 14);
    drawRosette(doc, M + PW - 16, 115, C.gold, 14);

    doc.end();
    stream.on('finish', () => resolve(path.posix.join(PDF_FOLDER, filename)));
    stream.on('error', reject);
  });
}

module.exports = { generatePassPdf };
