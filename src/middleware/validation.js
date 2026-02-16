const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errorHandler');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const messages = errors.array().map(err => err.msg).join(', ');
        throw new ValidationError(messages);
    }
    next();
};

module.exports = { validate };