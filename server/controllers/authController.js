const auth = require('../services/auth');

exports.login = (req, res) => {
  const { username, password } = req.body || {};
  res.json(auth.login(username, password));
};

exports.logout = (req, res) => {
  auth.logout(req.claims);
  res.json({ ok: true });
};

exports.me = (req, res) => {
  res.json({ user: req.user });
};

exports.changePassword = (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  auth.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ ok: true });
};
