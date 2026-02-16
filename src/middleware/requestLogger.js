const logger = require("../config/logger");

/**
 * Middleware pour logger toutes les requêtes HTTP
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Logger la requête entrante
  logger.http({
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    userId: req.user?.id || "anonymous",
  });

  // Capturer la réponse
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id || "anonymous",
    };

    // Logger selon le statut de la réponse
    if (res.statusCode >= 500) {
      logger.error(logData);
    } else if (res.statusCode >= 400) {
      logger.warn(logData);
    } else {
      logger.http(logData);
    }
  });

  next();
};

/**
 * Middleware pour logger les requêtes lentes (> 1s)
 */
const slowRequestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    // Logger si la requête a pris plus de 1 seconde
    if (duration > 1000) {
      logger.warn({
        message: "Slow request detected",
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        userId: req.user?.id || "anonymous",
      });
    }
  });

  next();
};

module.exports = {
  requestLogger,
  slowRequestLogger,
};
