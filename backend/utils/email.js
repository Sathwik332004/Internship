const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send email helper
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: options.html
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

// Send OTP Email
const sendOTPEmail = async (email, otp, otpType) => {
  const subject = otpType === 'login' 
    ? 'Your Login OTP - Medical Store Management System' 
    : 'Password Reset OTP - Medical Store Management System';
  
  const expiryMinutes = otpType === 'login' 
    ? process.env.LOGIN_OTP_EXPIRE_MINUTES || 5 
    : process.env.OTP_EXPIRE_MINUTES || 10;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #4F46E5; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Medical Store Management System</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #374151;">${otpType === 'login' ? 'Login' : 'Password Reset'} OTP</h2>
        <p style="color: #6b7280; font-size: 16px;">
          Your One Time Password (OTP) for ${otpType === 'login' ? 'login' : 'resetting your password'} is:
        </p>
        <div style="background-color: #e0e7ff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 5px;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This OTP will expire in ${expiryMinutes} minutes.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          If you did not request this OTP, please ignore this email.
        </p>
      </div>
      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Medical Store Management System. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: subject,
    html: html
  });
};

// Send Welcome Email
const sendWelcomeEmail = async (email, name) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #4F46E5; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Medical Store Management System</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #374151;">Welcome, ${name}!</h2>
        <p style="color: #6b7280; font-size: 16px;">
          Your account has been created successfully. You can now login to the Medical Store Management System.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Please contact your administrator if you have any questions.
        </p>
      </div>
      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Medical Store Management System. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Welcome to Medical Store Management System',
    html: html
  });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendWelcomeEmail
};
