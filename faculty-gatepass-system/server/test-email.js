require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

async function run() {
  // 1. Verify SMTP handshake
  console.log('--- SMTP Config ---');
  console.log('HOST :', process.env.EMAIL_HOST);
  console.log('PORT :', process.env.EMAIL_PORT);
  console.log('USER :', process.env.EMAIL_USER);
  console.log('FROM :', process.env.EMAIL_FROM);
  console.log('');

  try {
    await transporter.verify();
    console.log('[PASS] SMTP connection verified — server is ready.');
  } catch (err) {
    console.error('[FAIL] SMTP verify failed:', err.message);
    process.exit(1);
  }

  // 2. Send a real test email to the same Gmail account
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_USER,           // send to itself as a test
      subject: 'ExitLine - Email Delivery Test',
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2 style="color:#1f2937">ExitLine Notification</h2>
          <p>This is a <b>test email</b> sent from the ExitLine Gate Pass System.</p>
          <p>If you can read this, email delivery is working correctly!</p>
          <br>
          <p style="color:#6b7280;font-size:12px">
            This is an automated email from ExitLine Gate Pass System.
          </p>
        </div>
      `,
    });
    console.log('[PASS] Test email sent successfully!');
    console.log('       Message ID :', info.messageId);
    console.log('       SMTP response:', info.response);
  } catch (err) {
    console.error('[FAIL] Email send failed:', err.message);
    process.exit(1);
  }
}

run();
