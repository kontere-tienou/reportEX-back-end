const winston = require("winston");
const path = require("path");
const config = require("../config/config");

/**
 * ==========================================
 * LOGGING UTILITY
 * ==========================================
 */

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

winston.addColors(colors);

// Define format
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
    }`;
  }),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.printf((info) => {
        const { timestamp, level, message } = info;
        return `${timestamp} [${level}]: ${message}`;
      }),
    ),
  }),

  // Error log file
  new winston.transports.File({
    filename: path.join("logs", "error.log"),
    level: "error",
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join("logs", "combined.log"),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level || "info",
  levels,
  format,
  transports,
  exitOnError: false,
});

// Add audit log method
logger.audit = (data) => {
  logger.info("AUDIT", data);
};

// Add database log method
logger.database = (query, duration) => {
  logger.debug("DATABASE", { query, duration });
};

module.exports = logger;
