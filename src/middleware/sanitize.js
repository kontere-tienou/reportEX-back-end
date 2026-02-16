const validator = require('validator');

const sanitizeInput = (req, res, next) => {
    // Sanitize body
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = validator.escape(req.body[key].trim());
            }
        });
    }

    // Sanitize query
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = validator.escape(req.query[key].trim());
            }
        });
    }

    next();
};

module.exports = sanitizeInput;