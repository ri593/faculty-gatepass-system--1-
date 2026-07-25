const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  // Fix for self-signed certificate error on Windows / local development
  tls: {
    rejectUnauthorized: false,
  },
});

async function notify(userEmail, subject, message) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2 style="color:#1f2937">ExitLine Notification</h2>

          <div>${message}</div>

          <br>

          <p style="color:#6b7280;font-size:12px">
            This is an automated email from ExitLine Gate Pass System.
          </p>
        </div>
      `,
    });

    console.log(`[email] Sent to ${userEmail} | ${subject}`);
    return true;

  } catch (err) {
    console.error('[email] Failed:', err.message);
    return false;
  }
}

async function notifyMany(recipients, subject, message) {
  const emails = [...new Set(
    recipients
      .map(recipient => typeof recipient === 'string' ? recipient : recipient.email)
      .filter(Boolean)
  )];

  await Promise.all(emails.map(email => notify(email, subject, message)));
}

module.exports = { notify, notifyMany };