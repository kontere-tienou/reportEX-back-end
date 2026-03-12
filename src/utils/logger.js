const winston = require("winston");
const { format, transports } = winston;

const isProduction =
  process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

const logFormat = format.printf(({ timestamp, level, message, ...meta }) => {
  const metaString =
    Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : "";

  return `${timestamp} ${level.toUpperCase()} ▶ ${message}${metaString}`;
});

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",

  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    logFormat,
  ),

  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({ format: "HH:mm:ss" }),
        logFormat,
      ),
    }),
  ],

  exceptionHandlers: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({ format: "HH:mm:ss" }),
        format.printf(
          ({ timestamp, level, message, stack }) =>
            `${timestamp} EXCEPTION ▶ ${message}\n${stack || ""}`,
        ),
      ),
    }),
  ],

  rejectionHandlers: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({ format: "HH:mm:ss" }),
        format.printf(
          ({ timestamp, message, reason }) =>
            `${timestamp} REJECTION ▶ ${message} | ${reason}`,
        ),
      ),
    }),
  ],
});

// custom audit level
logger.audit = (data) => {
  logger.info("AUDIT", data);
};

logger.infoWithMeta = (message, meta = {}) => {
  logger.info(message, meta);
};

logger.errorWithMeta = (message, error, meta = {}) => {
  logger.error(message, {
    error: error?.message || error,
    stack: error?.stack,
    ...meta,
  });
};

module.exports = logger;
