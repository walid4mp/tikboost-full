const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');

const purchaseReceipt = asyncHandler(async (req, res) => {
  const row = await prisma.purchase.findUnique({
    where: { id: req.params.id },
    select: { notes: true, reference: true },
  });
  if (!row) throw new AppError('Not found', 404);
  let receipt = null;
  try { receipt = row.notes ? JSON.parse(row.notes).receiptImageData || null : null; } catch (_) {}
  if (!receipt) throw new AppError('Receipt not found', 404);
  res.json({ success: true, transactionId: row.reference, receiptImageData: receipt });
});
module.exports = { purchaseReceipt };
