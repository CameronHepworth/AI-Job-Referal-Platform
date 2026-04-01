const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendPasswordResetEmail(toEmail, otp) {
  const transporter = createTransport();

  await transporter.sendMail({
    from: `"GhostJob" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your GhostJob password reset code',
    text: `Your password reset code is: ${otp}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <div style="margin-bottom: 32px;">
          <div style="width: 56px; height: 56px; background: #ede9fe; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
            <span style="font-size: 28px;">👁️</span>
          </div>
          <h1 style="font-size: 22px; font-weight: 800; color: #111827; margin: 0 0 8px;">Reset your password</h1>
          <p style="color: #6b7280; font-size: 15px; margin: 0;">Enter the code below in the GhostJob app to reset your password.</p>
        </div>

        <div style="background: #f5f3ff; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Your reset code</p>
          <p style="font-size: 40px; font-weight: 800; color: #4f46e5; letter-spacing: 10px; margin: 0;">${otp}</p>
        </div>

        <p style="color: #9ca3af; font-size: 13px; text-align: center;">This code expires in <strong>15 minutes</strong>.<br/>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
