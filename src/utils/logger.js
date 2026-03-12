// src/utils/logger.js
const winston = require("winston");
const { format, transports } = winston;

// Determine if we're in production-like environment (Railway, etc.)
const isProduction =
  process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

// Custom format for better readability in Railway logs
const customFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.metadata(),
  format.json(), // Railway loves structured JSON logs
);

// Simple console-friendly format for development
const devFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata, null, 2)}`;
    }

    return msg;
  }),
);

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",

  format: isProduction
    ? customFormat
    : format.combine(format.colorize(), devFormat),

  transports: [
    // Always log to console (Railway captures stdout/stderr)
    new transports.Console({
      format: isProduction ? customFormat : devFormat,
    }),

    // Optional: log errors to a file (useful locally or if you mount persistent storage)
    // new transports.File({
    //   filename: 'logs/error.log',
    //   level: 'error',
    //   format: customFormat
    // }),
    // new transports.File({
    //   filename: 'logs/combined.log',
    //   format: customFormat
    // })
  ],

  // Handle exceptions & rejections
  exceptionHandlers: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(
          ({ timestamp, level, message, stack }) =>
            `${timestamp} [EXCEPTION] ${level}: ${message}\n${stack || ""}`,
        ),
      ),
    }),
  ],

  rejectionHandlers: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(
          ({ timestamp, level, message, reason, promise }) =>
            `${timestamp} [REJECTION] ${level}: ${message}\nReason: ${reason}\nPromise: ${promise}`,
        ),
      ),
    }),
  ],
});

// Optional: Add request-context support later if needed (with cls-rtracer or similar)

// Helper methods for common structured logging
logger.infoWithMeta = (message, meta = {}) => {
  logger.info(message, { ...meta });
};

logger.errorWithMeta = (message, error, meta = {}) => {
  logger.error(message, {
    error: error?.message || error,
    stack: error?.stack,
    ...meta,
  });
};

module.exports = logger;
