// src/config/config.js
require("dotenv").config();

module.exports = {
  // Server
  server: {
    port: process.env.PORT || 5008,
    env: process.env.NODE_ENV || "development",
    apiVersion: process.env.API_VERSION || "v1",
  },

  // Database - Local only
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || "reporting_batex-ci",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "Admin123",
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || "default-secret-change-in-production",
    expiry: process.env.JWT_EXPIRE || "1d", // Changed to match your .env
    refreshSecret: process.env.JWT_REFRESH_SECRET || "default-refresh-secret",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "30d",
  },

  // CORS - Local + Vercel (for testing)
  cors: {
    origin: [
      "https://report-ex.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    credentials: true,
  },

  // File Upload
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
    directory: process.env.UPLOAD_DIR || "./uploads",
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(",") || [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },

  // Email (for dev)
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM || "noreply@batex-ci.com",
  },

  // Other configs (simplified)
  logging: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || "./logs/app.log",
  },

  // Company
  company: {
    name: process.env.COMPANY_NAME || "BATEX-CI",
    address: process.env.COMPANY_ADDRESS || "Bamako, Mali",
    phone: process.env.COMPANY_PHONE,
    email: process.env.COMPANY_EMAIL || "contact@batex-ci.com",
  },

  // Pagination
  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  },
};
