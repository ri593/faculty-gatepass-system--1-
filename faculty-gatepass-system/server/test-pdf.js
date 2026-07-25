require('dotenv').config();
const { generatePassQr } = require('./services/qrService');
const { generatePassPdf } = require('./services/pdfService');

const testPass = {
  pass_code:       'GP-TEST',
  employee_id:     'AU250500',
  faculty_name:    'Shobhnath Shukla',
  department_name: 'B.Tech In Computer Science Engineering (AI/ML)',
  pass_date:       '2026-07-24',
  out_time:        '11:00 AM',
  expected_return: 'FULL TIME',
  destination:     'Bank Work',
  purpose:         'Bank work – account verification',
  status:          'Approved',
};

async function run() {
  console.log('Generating QR code...');
  const qrPath = await generatePassQr(testPass);
  console.log('[OK] QR saved:', qrPath);

  testPass.qr_code_path = qrPath;

  console.log('Generating PDF...');
  const pdfPath = await generatePassPdf(testPass);
  console.log('[OK] PDF saved:', pdfPath);
  console.log('');
  console.log('Open the PDF at:');
  console.log('  ' + require('path').join(__dirname, pdfPath));
}

run().catch(err => {
  console.error('[FAIL]', err.message);
  process.exit(1);
});
