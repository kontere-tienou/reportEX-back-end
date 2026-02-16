const winston = require('winston');
const path = require('path');

// Définir les niveaux de log
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Définir les couleurs pour chaque niveau
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// Format pour les logs
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`,
    ),
);

// Définir les transports (où les logs seront écrits)
const transports = [
    // Console logs
    new winston.transports.Console(),

    // Logs d'erreurs dans un fichier séparé
    new winston.transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),

    // Tous les logs dans un fichier combiné
    new winston.transports.File({
        filename: path.join('logs', 'combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
];

// Créer le logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    levels,
    format,
    transports,
});

// Fonction helper pour logger les erreurs avec contexte
logger.logError = (error, context = {}) => {
    logger.error({
        message: error.message,
        stack: error.stack,
        ...context
    });
};

// Fonction helper pour logger les requêtes HTTP
logger.logRequest = (req) => {
    logger.http({
        method: req.method,
        url: req.url,
        ip: req.ip,
        userId: req.user?.id || 'anonymous'
    });
};

module.exports = logger;