import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export class EmailService {
  private transporter: Transporter;

  constructor() {
    // Create email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Verify connection on initialization
    this.verifyConnection();
  }

  /**
   * Verify SMTP connection
   */
  private async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service ready');
    } catch (error) {
      console.warn('⚠️ Email service not configured properly:', error);
      console.warn('⚠️ Password recovery emails will not be sent');
    }
  }

  /**
   * Send password recovery email
   * Sends plain text password to user's email
   */
  async sendPasswordRecoveryEmail(email: string, username: string, password: string): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@autochess.com',
        to: email,
        subject: 'Auto Chess Arena - Password Recovery',
        text: `Hello ${username},

You requested to recover your password for Auto Chess Arena.

Your login credentials are:
Username: ${username}
Password: ${password}

You can now use these credentials to log in to the game.

If you didn't request this, please ignore this email.

Best regards,
Auto Chess Arena Team`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      border-radius: 10px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #00d4ff;
      margin: 0;
    }
    .content {
      background: rgba(255, 255, 255, 0.05);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid rgba(0, 212, 255, 0.3);
    }
    .credentials {
      background: rgba(0, 0, 0, 0.3);
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .credentials p {
      margin: 10px 0;
      font-size: 16px;
    }
    .credentials strong {
      color: #00d4ff;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 14px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎮 Auto Chess Arena</h1>
      <p>Password Recovery</p>
    </div>

    <div class="content">
      <p>Hello <strong>${username}</strong>,</p>

      <p>You requested to recover your password for Auto Chess Arena.</p>

      <div class="credentials">
        <p><strong>Username:</strong> ${username}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>

      <p>You can now use these credentials to log in to the game.</p>

      <p style="margin-top: 30px; font-size: 14px; color: #999;">
        If you didn't request this, please ignore this email.
      </p>
    </div>

    <div class="footer">
      <p>Best regards,<br>Auto Chess Arena Team</p>
    </div>
  </div>
</body>
</html>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Password recovery email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send password recovery email:', error);
      throw new Error('Failed to send recovery email');
    }
  }

  /**
   * Send welcome email (optional, for future use)
   */
  async sendWelcomeEmail(email: string, username: string, displayName: string): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@autochess.com',
        to: email,
        subject: 'Welcome to Auto Chess Arena!',
        text: `Welcome ${displayName}!

Thank you for joining Auto Chess Arena.

Your account has been created successfully:
Username: ${username}
Display Name: ${displayName}

You can now log in and start playing!

Best regards,
Auto Chess Arena Team`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      border-radius: 10px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #00d4ff;
      margin: 0;
    }
    .content {
      background: rgba(255, 255, 255, 0.05);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid rgba(0, 212, 255, 0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎮 Welcome to Auto Chess Arena!</h1>
    </div>

    <div class="content">
      <p>Hello <strong>${displayName}</strong>,</p>

      <p>Thank you for joining Auto Chess Arena!</p>

      <p>Your account has been created successfully. You can now log in and start playing against other players.</p>

      <p style="margin-top: 30px;">Good luck and have fun!</p>
    </div>

    <div style="text-align: center; margin-top: 20px; font-size: 14px; color: #999;">
      <p>Best regards,<br>Auto Chess Arena Team</p>
    </div>
  </div>
</body>
</html>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Welcome email sent to ${email}`);
    } catch (error) {
      console.error('⚠️ Failed to send welcome email:', error);
      // Don't throw error - welcome email is not critical
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
