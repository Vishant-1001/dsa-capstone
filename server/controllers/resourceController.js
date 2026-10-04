const resources = require('../services/resources');

exports.list = (req, res) => res.json({ contacts: resources.list(req.query) });
exports.create = (req, res) => res.status(201).json({ contact: resources.create(req.body || {}) });
exports.update = (req, res) => res.json({ contact: resources.update(req.params.id, req.body || {}) });
exports.remove = (req, res) => {
  resources.remove(req.params.id);
  res.json({ deleted: true });
};
