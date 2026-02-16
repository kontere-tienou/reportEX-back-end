const { transporter, emailTemplates } = require('../config/email');
const logger = require('../config/logger');
const { SUCCESS_MESSAGES, ERROR_MESSAGES } = require('../config/constants');

const emailService = {
  /**
   * Envoyer un email générique
   */
  async sendEmail({ to, subject, html, text }) {
    if (!transporter) {
      logger.warn("Email service not configured. Email not sent.");
      return { success: false, message: "Service email non configuré" };
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html,
        text: text || undefined,
      };

      const info = await transporter.sendMail(mailOptions);

      logger.info(`Email sent successfully to ${to}: ${subject}`);

      return {
        success: true,
        messageId: info.messageId,
        message: SUCCESS_MESSAGES.EMAIL_SENT,
      };
    } catch (error) {
      logger.error("Error sending email:", error);
      return {
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: error.message,
      };
    }
  },

  /**
   * Envoyer une notification de rapport soumis
   */
  async sendReportSubmittedEmail(validators, reportData) {
    if (!validators || validators.length === 0) {
      logger.warn("No validators to notify for report submission");
      return;
    }

    const results = [];

    for (const validator of validators) {
      const template = emailTemplates.reportSubmitted(
        reportData,
        validator.full_name,
      );

      const result = await this.sendEmail({
        to: validator.email,
        subject: template.subject,
        html: template.html,
      });

      results.push({ validator: validator.email, ...result });
    }

    return results;
  },

  /**
   * Envoyer une notification de rapport validé
   */
  async sendReportValidatedEmail(userEmail, userName, reportData) {
    const template = emailTemplates.reportValidated(reportData, userName);

    return await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
    });
  },

  /**
   * Envoyer un rappel de rapport hebdomadaire
   */
  async sendWeeklyReminderEmail(userEmail, userName, departmentName) {
    const template = emailTemplates.weeklyReminder(userName, departmentName);

    return await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
    });
  },

  /**
   * Envoyer un rappel de rapport mensuel
   */
  async sendMonthlyReminderEmail(userEmail, userName, departmentName) {
    const template = emailTemplates.monthlyReminder(userName, departmentName);

    return await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
    });
  },

  /**
   * Envoyer des rappels en masse
   */
  async sendBulkReminders(users, frequency) {
    const results = [];

    for (const user of users) {
      let result;

      if (frequency === "hebdomadaire") {
        result = await this.sendWeeklyReminderEmail(
          user.email,
          user.full_name,
          user.department_name,
        );
      } else if (frequency === "mensuel") {
        result = await this.sendMonthlyReminderEmail(
          user.email,
          user.full_name,
          user.department_name,
        );
      }

      results.push({
        user: user.email,
        frequency,
        ...result,
      });

      // Petit délai pour éviter de surcharger le serveur SMTP
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  },

  /**
   * Envoyer un email de bienvenue à un nouvel utilisateur
   */
  async sendWelcomeEmail(userEmail, userName, temporaryPassword) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1>Bienvenue sur BATEX-CI Reporting</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2>Bonjour ${userName},</h2>
          <p>Votre compte a été créé avec succès sur le système de reporting BATEX-CI.</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Informations de connexion</h3>
            <p><strong>URL:</strong> ${process.env.FRONTEND_URL}</p>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Mot de passe temporaire:</strong> <code style="background:#f3f4f6; padding:4px 8px; border-radius:4px;">${temporaryPassword}</code></p>
          </div>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;">
              <strong>⚠️ Important:</strong> Veuillez changer votre mot de passe lors de votre première connexion.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Se connecter
            </a>
          </div>
        </div>
        <div style="background-color: #e5e7eb; padding: 15px; text-align: center; font-size: 12px;">
          <p>BATEX-CI - Système de Reporting</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject: "Bienvenue sur BATEX-CI Reporting",
      html,
    });
  },

  /**
   * Tester la configuration email
   */
  async testEmailConfiguration() {
    if (!transporter) {
      return { success: false, message: "Email service not configured" };
    }

    try {
      await transporter.verify();
      return { success: true, message: "Email configuration is valid" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  async sendReportValidatedEmail(userEmail, validatorName, reportData) {
    const template = emailTemplates.reportValidated(reportData, validatorName);

    return await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
    });
    },
  
  /**
   * Envoyer une notification de rapport rejeté
   */

  async sendReportRejectedEmail(userEmail, validatorName, reportData, reason) {
    const template = emailTemplates.reportRejected(
      reportData,
      validatorName,
      reason,
    );

    return await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
    });
  },

  async sendEmail({ to, subject, html }) {
    try {
      const mailOptions = { from: process.env.EMAIL_FROM, to, subject, html };
      const info = await transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error("Error sending email:", error);
      return { success: false, message: "Error sending email" };
    }
  },
};

module.exports = emailService;