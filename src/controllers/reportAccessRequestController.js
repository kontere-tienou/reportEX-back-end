const service = require("../services/reportAccessRequestService");

exports.requestAccess = async (req, res, next) => {
  try {
    const result = await service.requestAccess(req.user, req.params.reportId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.approve = async (req, res, next) => {
  try {
    const result = await service.approve(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.reject = async (req, res, next) => {
  try {
    const result = await service.reject(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getPending = async (req, res, next) => {
  try {
    const result = await service.getPending();
    res.json(result);
  } catch (err) {
    next(err);
  }
};
