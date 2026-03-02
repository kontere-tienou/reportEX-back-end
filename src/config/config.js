require("dotenv").config();

/**
 * ==========================================
 * APPLICATION CONFIGURATION
 * ==========================================
 */

module.exports = {
  // Server
  server: {
    port: process.env.PORT || 5008,
    env: process.env.NODE_ENV || "development",
    apiVersion: process.env.API_VERSION || "v1",
  },

  // Database
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || "batex_erp",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || "default-secret-change-in-production",
    expiry: process.env.JWT_EXPIRY || "7d",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "default-refresh-secret",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "30d",
  },

  // CORS
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:5173",
    ],
    /*origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "https://f746-154-118-146-238.ngrok-free.app",
    ],*/
    credentials: true,
  },

  // File Upload
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    directory: process.env.UPLOAD_DIR || "./uploads",
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(",") || [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },

  // Email
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM || "BATEX ERP <contact@batex-ci.com>",
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || "./logs/app.log",
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  // Company
  company: {
    name: process.env.COMPANY_NAME || "BATEX-CI",
    address: process.env.COMPANY_ADDRESS || "Bamako, Mali",
    phone: process.env.COMPANY_PHONE,
    email: process.env.COMPANY_EMAIL || "contact@batex-ci.com",
  },

  // Features
  features: {
    emailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === "true",
    smsNotifications: process.env.ENABLE_SMS_NOTIFICATIONS === "true",
    auditLogs: process.env.ENABLE_AUDIT_LOGS === "true",
    fileCompression: process.env.ENABLE_FILE_COMPRESSION === "true",
  },

  // Backup
  backup: {
    enabled: process.env.AUTO_BACKUP_ENABLED === "true",
    schedule: process.env.BACKUP_SCHEDULE || "0 2 * * *",
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
  },

  // Departments
  departments: [
    { id: 1, code: "RH", name: "Ressources Humaines", icon: "users" },
    { id: 2, code: "COMPTA", name: "Comptabilité", icon: "calculator" },
    { id: 3, code: "CAISSE", name: "Caisse", icon: "wallet" },
    { id: 4, code: "ACHAT", name: "Achats", icon: "shopping-cart" },
    { id: 5, code: "DG", name: "Direction Générale", icon: "briefcase" },
    { id: 6, code: "STOCK_MAT", name: "Stock Matériels", icon: "package" },
    { id: 7, code: "MAGASIN", name: "Magasin", icon: "warehouse" },
    { id: 8, code: "IMPRESSION", name: "Impression", icon: "printer" },
    { id: 9, code: "LABO", name: "Laboratoire", icon: "flask" },
    { id: 10, code: "CONFECTION", name: "Confection", icon: "scissors" },
    { id: 11, code: "MAINTENANCE", name: "Maintenance", icon: "wrench" },
    { id: 12, code: "VAPO", name: "Vapo/Énergie", icon: "zap" },
    { id: 13, code: "IT", name: "Informatique", icon: "monitor" },
    {
      id: 14,
      code: "CONTROLE",
      name: "Contrôle de Gestion",
      icon: "pie-chart",
    },
    { id: 15, code: "COMMERCIAL", name: "Commercial", icon: "trending-up" },
  ],

  // User Roles
  roles: [
    { id: 1, code: "ADMIN", name: "Administrateur", level: 10 },
    { id: 2, code: "DG", name: "Direction Générale", level: 9 },
    { id: 3, code: "MANAGER", name: "Manager", level: 7 },
    { id: 4, code: "SUPERVISOR", name: "Superviseur", level: 5 },
    { id: 5, code: "USER", name: "Utilisateur", level: 3 },
    { id: 6, code: "VIEWER", name: "Lecteur", level: 1 },
  ],

  // Pagination
  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  },
};
