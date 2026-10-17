const { body } = require('express-validator');
const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');

const submit = asyncHandler(async (req, res) => {
  const { subject, message, email } = req.body;
  if (!subject || !message) throw new AppError('subject and message required', 400);
  const row = await prisma.report.create({
    data: {
      reporterId: req.user.id, reportedId: req.user.id,
      targetType: 'CONTACT', targetId: req.user.id,
      reason: 'CONTACT',
      description: `[${email || req.user.email}] ${subject}\n\n${message}`,
    },
  });
  res.json({ success: true, ticket: row.id });
});

module.exports = { submit };
