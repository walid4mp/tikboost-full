const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const env = require('../config/env');
const { randomCode } = require('../utils/helpers');

const PACKAGES = [
  { slug: 'starter', name: 'Starter', priceCents: 100, points: 100000n, bonusPoints: 0n, sortOrder: 1 },
  { slug: 'basic', name: 'Basic', priceCents: 500, points: 500000n, bonusPoints: 50000n, sortOrder: 2 },
  { slug: 'pro', name: 'Pro', priceCents: 1000, points: 1000000n, bonusPoints: 120000n, sortOrder: 3 },
  { slug: 'elite', name: 'Elite', priceCents: 2500, points: 2800000n, bonusPoints: 400000n, sortOrder: 4 },
  { slug: 'vip', name: 'VIP', priceCents: 5000, points: 6000000n, bonusPoints: 1000000n, sortOrder: 5 },
];

const WHEEL = [
  { label: '500', points: 500n, weight: 35, color: '#9ca3af', sortOrder: 0 },
  { label: '1,000', points: 1000n, weight: 25, color: '#22c55e', sortOrder: 1 },
  { label: '2,500', points: 2500n, weight: 15, color: '#3b82f6', sortOrder: 2 },
  { label: '5,000', points: 5000n, weight: 10, color: '#a855f7', sortOrder: 3 },
  { label: '10,000', points: 10000n, weight: 8, color: '#f59e0b', sortOrder: 4 },
  { label: '25,000', points: 25000n, weight: 4, color: '#ef4444', sortOrder: 5 },
  { label: '50,000', points: 50000n, weight: 2, color: '#ec4899', sortOrder: 6 },
  { label: '100,000', points: 100000n, weight: 1, color: '#ffd700', sortOrder: 7 },
];

async function ensureAdmin() {
  const hash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, env.BCRYPT_ROUNDS);

  const existing = await prisma.user.findUnique({
    where: { email: env.SEED_ADMIN_EMAIL },
    select: { id: true, referralCode: true },
  });

  const admin = await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL },
    update: {
      password: hash,
      name: env.SEED_ADMIN_NAME,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
    create: {
      email: env.SEED_ADMIN_EMAIL,
      password: hash,
      name: env.SEED_ADMIN_NAME,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      referralCode: existing?.referralCode || randomCode(10),
      points: 0n,
      totalEarned: 0n,
      totalSpent: 0n,
    },
  });

  console.log('✓ Admin ready:', admin.email);
}

async function ensurePackages() {
  for (const pkg of PACKAGES) {
    await prisma.pointPackage.upsert({
      where: { slug: pkg.slug },
      update: {
        name: pkg.name,
        priceCents: pkg.priceCents,
        currency: 'USD',
        points: pkg.points,
        bonusPoints: pkg.bonusPoints,
        isActive: true,
        sortOrder: pkg.sortOrder,
      },
      create: {
        ...pkg,
        currency: 'USD',
        isActive: true,
      },
    });
  }
  console.log('✓ Packages ready:', PACKAGES.length);
}

async function ensureWheel() {
  for (const prize of WHEEL) {
    const existing = await prisma.wheelPrize.findFirst({
      where: { sortOrder: prize.sortOrder },
      select: { id: true },
    });

    if (existing) {
      await prisma.wheelPrize.update({
        where: { id: existing.id },
        data: {
          label: prize.label,
          points: prize.points,
          weight: prize.weight,
          color: prize.color,
          isActive: true,
          sortOrder: prize.sortOrder,
        },
      });
    } else {
      await prisma.wheelPrize.create({
        data: {
          ...prize,
          isActive: true,
        },
      });
    }
  }
  console.log('✓ Wheel prizes ready:', WHEEL.length);
}

(async () => {
  console.log('▶ Seeding TikBoost core data...');
  await ensureAdmin();
  await ensurePackages();
  await ensureWheel();
  console.log('✔ Seed finished successfully.');
  await prisma.$disconnect();
  process.exit(0);
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
