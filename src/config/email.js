const nodemailer = require('nodemailer');
const logger = require('./logger');

// Configuration du transporteur email
const createTransporter = () => {
    // Vérifier si les variables d'environnement sont définies
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
        logger.warn('Email configuration incomplete. Email sending disabled.');
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });
};

const transporter = createTransporter();

// Vérifier la configuration au démarrage
if (transporter) {
    transporter.verify((error, success) => {
        if (error) {
            logger.error('Email configuration error:', error);
        } else {
            logger.info('✉️  Email server is ready to send messages');
        }
    });
}

// Templates d'emails
const emailTemplates = {
    // Rapport soumis pour validation
    reportSubmitted: (reportData, validatorName) => ({
        subject: 'Nouveau rapport à valider - BATEX-CI',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1>BATEX-CI - Nouveau Rapport</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2>Bonjour ${validatorName},</h2>
          <p>Un nouveau rapport a été soumis et nécessite votre validation.</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Détails du rapport</h3>
            <p><strong>Type:</strong> ${reportData.template_name}</p>
            <p><strong>Période:</strong> ${reportData.period_start} - ${reportData.period_end}</p>
            <p><strong>Département:</strong> ${reportData.department_name}</p>
            <p><strong>Soumis par:</strong> ${reportData.author_name}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/reports/${reportData.id}" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Voir le rapport
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Connectez-vous au système de reporting pour valider ou rejeter ce rapport.
          </p>
        </div>
        <div style="background-color: #e5e7eb; padding: 15px; text-align: center; font-size: 12px;">
          <p>BATEX-CI - Système de Reporting</p>
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>
    `
    }),

    // Rapport validé
    reportValidated: (reportData, userName) => ({
        subject: 'Votre rapport a été validé - BATEX-CI',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
          <h1>✓ Rapport Validé</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2>Bonjour ${userName},</h2>
          <p>Votre rapport a été <strong style="color: #10b981;">validé avec succès</strong>.</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Détails du rapport</h3>
            <p><strong>Type:</strong> ${reportData.template_name}</p>
            <p><strong>Période:</strong> ${reportData.period_start} - ${reportData.period_end}</p>
            <p><strong>Validé par:</strong> ${reportData.validator_name}</p>
            <p><strong>Date de validation:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/reports/${reportData.id}" 
               style="background-color: #10b981; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Voir le rapport
            </a>
          </div>
        </div>
        <div style="background-color: #e5e7eb; padding: 15px; text-align: center; font-size: 12px;">
          <p>BATEX-CI - Système de Reporting</p>
        </div>
      </div>
    `
    }),

    // Rapport rejeté
    reportRejected: (reportData, userName, reason) => ({
        subject: 'Votre rapport a été rejeté - BATEX-CI',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #ef4444; color: white; padding: 20px; text-align: center;">
          <h1>⚠ Rapport Rejeté</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2>Bonjour ${userName},</h2>
          <p>Votre rapport a été <strong style="color: #ef4444;">rejeté</strong> et nécessite des corrections.</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Détails du rapport</h3>
            <p><strong>Type:</strong> ${reportData.template_name}</p>
            <p><strong>Période:</strong> ${reportData.period_start} - ${reportData.period_end}</p>
            <p><strong>Rejeté par:</strong> ${reportData.validator_name}</p>
          </div>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #dc2626;">Raison du rejet:</h4>
            <p>${reason || 'Aucune raison spécifiée'}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/reports/${reportData.id}" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Modifier le rapport
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Veuillez corriger le rapport selon les commentaires et le soumettre à nouveau.
          </p>
        </div>
        <div style="background-color: #e5e7eb; padding: 15px; text-align: center; font-size: 12px;">
          <p>BATEX-CI - Système de Reporting</p>
        </div>
      </div>
    `
    }),

    // Rappel rapport hebdomadaire
    weeklyReminder: (userName, departmentName) => ({
        subject: 'Rappel: Rapport hebdomadaire à soumettre - BATEX-CI',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1>📅 Rappel Rapport Hebdomadaire</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2>Bonjour ${userName},</h2>
          <p>Ceci est un rappel pour soumettre votre rapport hebdomadaire.</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Informations</h3>
            <p><strong>Département:</strong> ${departmentName}</p>
            <p><strong>Type:</strong> Rapport Hebdomadaire</p>
            <p><strong>Échéance:</strong> Fin de semaine</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/reports/new" 
               style="background-color: #f59e0b; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Créer le rapport
            </a>
          </div>
        </div>
        <div style="background-color: #e5e7eb; padding: 15px; text-align: center; font-size: 12px;">
          <p>BATEX-CI - Système de Reporting</p>
        </div>
      </div>
    `
    }),

    // Rappel rapport mensuel
    monthlyReminder: (userName, departmentName) => ({
        subject: 'Rappel: Rapport mensuel à soumettre - BATEX-CI',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #8b5cf6; color: white; padding: 20px; text-align: center;">
          <h1>📊 Rappel Rapport Mensuel</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <h2>Bonjour ${userName},</h2>
          <p>Ceci est un rappel pour soumettre votre rapport mensuel.</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Informations</h3>
            <p><strong>Département:</strong> ${departmentName}</p>
            <p><strong>Type:</strong> Rapport Mensuel</p>
            <p><strong>Échéance:</strong> Fin du mois</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/reports/new" 
               style="background-color: #8b5cf6; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Créer le rapport
            </a>
          </div>
        </div>
        <div style="background-color: #e5e7eb; padding: 15px; text-align: center; font-size: 12px;">
          <p>BATEX-CI - Système de Reporting</p>
        </div>
      </div>
    `
    })
};

module.exports = {
    transporter,
    emailTemplates
};