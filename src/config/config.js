require("dotenv").config();

// Single source of truth for all allowed origins
const ALLOWED_ORIGINS = [
  "https://report-ex.vercel.app",
  "https://reportex-back-end-production.up.railway.app",
  "https://reportex-back-end.up.railway.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

module.exports = {
  server: {
    port: process.env.PORT || 5008,
    env: process.env.NODE_ENV || "development",
    apiVersion: process.env.API_VERSION || "v1",
  },

  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || "batex_erp",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET || "default-secret-change-in-production",
    expiry: process.env.JWT_EXPIRY || "7d",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "default-refresh-secret",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "30d",
  },

  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },

  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
    directory: process.env.UPLOAD_DIR || "./uploads",
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(",") || [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },

  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || "BATEX ERP <noreply@batex-ci.com>",
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || "./logs/app.log",
  },

  rateLimit: {
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  company: {
    name: process.env.COMPANY_NAME || "BATEX-CI",
    address: process.env.COMPANY_ADDRESS || "Bamako, Mali",
    phone: process.env.COMPANY_PHONE,
    email: process.env.COMPANY_EMAIL || "contact@batex-ci.com",
  },

  features: {
    emailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === "true",
    smsNotifications: process.env.ENABLE_SMS_NOTIFICATIONS === "true",
    auditLogs: process.env.ENABLE_AUDIT_LOGS === "true",
    fileCompression: process.env.ENABLE_FILE_COMPRESSION === "true",
  },

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

  roles: [
    { id: 1, code: "ADMIN", name: "Administrateur", level: 10 },
    { id: 2, code: "DG", name: "Direction Générale", level: 9 },
    { id: 3, code: "MANAGER", name: "Manager", level: 7 },
    { id: 4, code: "SUPERVISOR", name: "Superviseur", level: 5 },
    { id: 5, code: "USER", name: "Utilisateur", level: 3 },
    { id: 6, code: "VIEWER", name: "Lecteur", level: 1 },
  ],

  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  },

  // Export for use in server.js directly
  ALLOWED_ORIGINS,
};
