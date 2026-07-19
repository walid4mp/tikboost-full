const prisma = require('../config/db');

/**
 * Atomic point adjustment with ledger write.
 * delta can be positive (grant/earn) or negative (spend/deduct).
 */
async function adjustPoints(userId, delta, reason, extra = {}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('USER_NOT_FOUND');
    const newBalance = BigInt(user.points) + BigInt(delta);
    if (newBalance < 0n) throw new Error('INSUFFICIENT_POINTS');
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        points: newBalance,
        totalEarned: delta > 0n ? BigInt(user.totalEarned) + BigInt(delta) : user.totalEarned,
        totalSpent:  delta < 0n ? BigInt(user.totalSpent)  + BigInt(-delta) : user.totalSpent,
      },
    });
    await tx.pointLog.create({
      data: {
        userId,
        delta: BigInt(delta),
        balanceAfter: newBalance,
        reason,
        refType: extra.refType || null,
        refId:   extra.refId   || null,
        note:    extra.note    || null,
      },
    });
    return updated;
  });
}

module.exports = { adjustPoints };
