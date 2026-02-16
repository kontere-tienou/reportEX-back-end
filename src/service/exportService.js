const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const { formatDateFR } = require("../utils/dateHelpers");
const logger = require("../config/logger");

const exportService = {
  /**
   * Générer un PDF pour un rapport
   */
  async generateReportPDF(report) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 50,
          size: "A4",
        });

        const fileName = `rapport_${report.id}_${Date.now()}.pdf`;
        const exportDir = path.join(__dirname, "../../exports");
        const filePath = path.join(exportDir, fileName);

        // Créer le dossier exports s'il n'existe pas
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true });
        }

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // En-tête avec logo et titre
        doc
          .fontSize(24)
          .fillColor("#2563eb")
          .text("BATEX-CI", { align: "center" })
          .fontSize(14)
          .fillColor("#666666")
          .text("Système de Reporting", { align: "center" })
          .moveDown(2);

        // Ligne de séparation
        doc
          .moveTo(50, doc.y)
          .lineTo(550, doc.y)
          .strokeColor("#2563eb")
          .lineWidth(2)
          .stroke()
          .moveDown();

        // Titre du rapport
        doc
          .fontSize(18)
          .fillColor("#000000")
          .text(report.template_name, { underline: true })
          .moveDown();

        // Informations du rapport
        doc.fontSize(11).fillColor("#333333");

        const infoItems = [
          ["Département", report.department_name],
          [
            "Période",
            `${formatDateFR(report.period_start)} - ${formatDateFR(report.period_end)}`,
          ],
          ["Créé par", report.author_name],
          ["Date de création", formatDateFR(report.created_at)],
          ["Statut", report.status.toUpperCase()],
        ];

        if (report.submitted_at) {
          infoItems.push(["Soumis le", formatDateFR(report.submitted_at)]);
        }

        if (report.validated_at && report.validator_name) {
          infoItems.push(["Validé par", report.validator_name]);
          infoItems.push([
            "Date de validation",
            formatDateFR(report.validated_at),
          ]);
        }

        infoItems.forEach(([label, value]) => {
          doc
            .font("Helvetica-Bold")
            .text(`${label}: `, { continued: true })
            .font("Helvetica")
            .text(value);
        });

        doc.moveDown(2);

        // Données du rapport
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#2563eb")
          .text("Données du rapport", { underline: true })
          .moveDown();

        doc.fontSize(10).fillColor("#000000");

        const data =
          typeof report.data === "string"
            ? JSON.parse(report.data)
            : report.data;
        const fields =
          typeof report.fields === "string"
            ? JSON.parse(report.fields)
            : report.fields;

        // Créer un mapping des IDs aux labels
        const fieldLabels = {};
        if (fields && Array.isArray(fields)) {
          fields.forEach((field) => {
            fieldLabels[field.id] = {
              label: field.label,
              unit: field.unit || "",
            };
          });
        }

        // Afficher les données
        Object.entries(data).forEach(([key, value]) => {
          const fieldInfo = fieldLabels[key] || { label: key, unit: "" };
          const displayValue = value || "N/A";
          const unit = fieldInfo.unit ? ` ${fieldInfo.unit}` : "";

          doc
            .font("Helvetica-Bold")
            .text(`${fieldInfo.label}: `, { continued: true })
            .font("Helvetica")
            .text(`${displayValue}${unit}`);
        });

        // Commentaires de rejet si applicable
        if (report.status === "rejete" && report.rejection_reason) {
          doc.moveDown(2);
          doc
            .fontSize(12)
            .font("Helvetica-Bold")
            .fillColor("#dc2626")
            .text("Raison du rejet:", { underline: true })
            .moveDown(0.5);

          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#000000")
            .text(report.rejection_reason, {
              width: 500,
              align: "justify",
            });
        }

        // Pied de page
        const pageHeight = doc.page.height;
        doc
          .fontSize(8)
          .fillColor("#999999")
          .text(
            `Généré le ${new Date().toLocaleString("fr-FR")} - BATEX-CI Reporting System`,
            50,
            pageHeight - 50,
            { align: "center", width: 500 },
          );

        doc.end();

        stream.on("finish", () => {
          logger.info(`PDF generated: ${fileName}`);
          resolve({ filePath, fileName });
        });

        stream.on("error", (error) => {
          logger.error("Error writing PDF:", error);
          reject(error);
        });
      } catch (error) {
        logger.error("Error generating PDF:", error);
        reject(error);
      }
    });
  },
  // Générer un PDF avec plusieurs rapports
  async generateBatchPDFReports(reports) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
  
        const fileName = `reports_batch_${Date.now()}.pdf`;
        const exportDir = path.join(__dirname, "../../exports");
        const filePath = path.join(exportDir, fileName);
  
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true });
        }
  
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
  
        reports.forEach((report) => {
          doc.addPage()
            .fontSize(24)
            .text(`Report for ${report.template_name}`, { align: 'center' })
            .moveDown();
          doc.fontSize(12).text(`Date: ${formatDateFR(report.created_at)}`);
          doc.text(`Status: ${report.status}`);
          doc.text(`Department: ${report.department_name}`);
          doc.text(`Author: ${report.author_name}`);
          doc.text(`Data: ${JSON.stringify(report.data)}`);
        });
  
        doc.end();
  
        stream.on("finish", () => {
          logger.info(`PDF batch generated: ${fileName}`);
          resolve({ filePath, fileName });
        });
  
        stream.on("error", (error) => {
          logger.error("Error generating batch PDF:", error);
          reject(error);
        });
      } catch (error) {
        logger.error("Error generating batch PDF:", error);
        reject(error);
      }
    });
  },
  
  /**
   * Générer un fichier Excel avec plusieurs rapports
   */
  async generateReportsExcel(reports, departmentName = null) {
    try {
      const workbook = new ExcelJS.Workbook();

      // Métadonnées
      workbook.creator = "BATEX-CI Reporting System";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Rapports");

      // Définir les colonnes
      worksheet.columns = [
        { header: "ID", key: "id", width: 8 },
        { header: "Type", key: "template_name", width: 30 },
        { header: "Département", key: "department_name", width: 20 },
        { header: "Début période", key: "period_start", width: 15 },
        { header: "Fin période", key: "period_end", width: 15 },
        { header: "Statut", key: "status", width: 12 },
        { header: "Auteur", key: "author_name", width: 20 },
        { header: "Créé le", key: "created_at", width: 15 },
        { header: "Soumis le", key: "submitted_at", width: 15 },
        { header: "Validé le", key: "validated_at", width: 15 },
      ];

      // Style de l'en-tête
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
      worksheet.getRow(1).alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      // Ajouter les données
      reports.forEach((report) => {
        const row = worksheet.addRow({
          id: report.id,
          template_name: report.template_name,
          department_name: report.department_name,
          period_start: new Date(report.period_start).toLocaleDateString(
            "fr-FR",
          ),
          period_end: new Date(report.period_end).toLocaleDateString("fr-FR"),
          status: report.status.toUpperCase(),
          author_name: report.author_name,
          created_at: new Date(report.created_at).toLocaleDateString("fr-FR"),
          submitted_at: report.submitted_at
            ? new Date(report.submitted_at).toLocaleDateString("fr-FR")
            : "",
          validated_at: report.validated_at
            ? new Date(report.validated_at).toLocaleDateString("fr-FR")
            : "",
        });

        // Coloration selon le statut
        const statusColors = {
          valide: "C6EFCE",
          soumis: "FFEB9C",
          rejete: "FFC7CE",
          brouillon: "E7E6E6",
        };

        const statusColor = statusColors[report.status] || "FFFFFF";
        row.getCell("status").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF" + statusColor },
        };
      });

      // Auto-filtres
      worksheet.autoFilter = {
        from: "A1",
        to: "J1",
      };

      // Figer la première ligne
      worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

      // Nom du fichier
      const timestamp = Date.now();
      const deptPrefix = departmentName
        ? `${departmentName.replace(/\s+/g, "_")}_`
        : "";
      const fileName = `rapports_${deptPrefix}${timestamp}.xlsx`;
      const exportDir = path.join(__dirname, "../../exports");
      const filePath = path.join(exportDir, fileName);

      // Créer le dossier exports s'il n'existe pas
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      // Sauvegarder le fichier
      await workbook.xlsx.writeFile(filePath);

      logger.info(`Excel generated: ${fileName}`);
      return { filePath, fileName };
    } catch (error) {
      logger.error("Error generating Excel:", error);
      throw error;
    }
  },

  /**
   * Générer un Excel avec statistiques consolidées
   */
  async generateStatsExcel(stats, departmentName) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Statistiques");

      // Titre
      worksheet.mergeCells("A1:B1");
      worksheet.getCell("A1").value = `Statistiques - ${departmentName}`;
      worksheet.getCell("A1").font = { size: 16, bold: true };
      worksheet.getCell("A1").alignment = { horizontal: "center" };

      worksheet.addRow([]);

      // Données
      const statsData = [
        ["Total rapports", stats.total_reports],
        ["Rapports validés", stats.validated_reports],
        ["Rapports en attente", stats.pending_reports],
        ["Rapports rejetés", stats.rejected_reports],
        ["Brouillons", stats.draft_reports],
        ["Taux de validation", `${stats.validation_rate}%`],
        ["Taux de rejet", `${stats.rejection_rate}%`],
      ];

      if (stats.avg_validation_time_hours) {
        statsData.push([
          "Temps moyen validation",
          `${stats.avg_validation_time_hours}h`,
        ]);
      }

      statsData.forEach(([label, value]) => {
        const row = worksheet.addRow([label, value]);
        row.getCell(1).font = { bold: true };
      });

      // Style
      worksheet.columns = [{ width: 30 }, { width: 20 }];

      const fileName = `stats_${departmentName.replace(/\s+/g, "_")}_${Date.now()}.xlsx`;
      const exportDir = path.join(__dirname, "../../exports");
      const filePath = path.join(exportDir, fileName);

      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      await workbook.xlsx.writeFile(filePath);

      logger.info(`Stats Excel generated: ${fileName}`);
      return { filePath, fileName };
    } catch (error) {
      logger.error("Error generating stats Excel:", error);
      throw error;
    }
  },

  /**
   * Nettoyer les anciens fichiers exports (> 7 jours)
   */
  async cleanupOldExports() {
    try {
      const exportDir = path.join(__dirname, "../../exports");

      if (!fs.existsSync(exportDir)) {
        return 0;
      }

      const files = fs.readdirSync(exportDir);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
      let deletedCount = 0;

      files.forEach((file) => {
        const filePath = path.join(exportDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });

      logger.info(`Cleaned up ${deletedCount} old export files`);
      return deletedCount;
    } catch (error) {
      logger.error("Error cleaning up exports:", error);
      throw error;
    }
  },
};

module.exports = exportService;
