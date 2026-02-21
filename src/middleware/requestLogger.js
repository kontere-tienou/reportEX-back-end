const morgan = require("morgan");
const logger = require("../utils/logger");
const config = require("../config/config");

/**
 * ==========================================
 * REQUEST LOGGING MIDDLEWARE
 * ==========================================
 */

/**
 * Custom token for user ID
 */
morgan.token("user-id", (req) => {
  return req.userId || "anonymous";
});

/**
 * Custom token for response time in ms
 */
morgan.token("response-time-ms", (req, res) => {
  if (!req._startAt || !res._startAt) {
    return "-";
  }

  const ms =
    (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6;

  return ms.toFixed(3);
});

/**
 * Custom format
 */
const customFormat =
  ":method :url :status :response-time-ms ms - :user-id - :remote-addr";

/**
 * Stream configuration
 */
const stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

/**
 * Development logger
 */
const developmentLogger = morgan("dev", { stream });

/**
 * Production logger
 */
const productionLogger = morgan(customFormat, {
  stream,
  skip: (req, res) => {
    // Skip health check and static files
    return req.url === "/health" || req.url.startsWith("/static");
  },
});

/**
 * Request logger based on environment
 */
const requestLogger =
  config.server.env === "production" ? productionLogger : developmentLogger;

/**
 * Audit logger (detailed logging for audit trail)
 */
const auditLogger = async (req, res, next) => {
  // Skip non-modifying methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Log after response
  const oldSend = res.send;
  res.send = function (data) {
    res.send = oldSend;

    // Log to database or file
    logger.audit({
      timestamp: new Date(),
      userId: req.userId,
      method: req.method,
      url: req.originalUrl,
      body: req.body,
      status: res.statusCode,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.send(data);
  };

  next();
};

/**
 * Request ID middleware
 */
const requestId = (req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  res.setHeader("X-Request-ID", req.id);
  next();
};

module.exports = {
  requestLogger,
  auditLogger,
  requestId,
};
