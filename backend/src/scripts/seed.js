const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const env = require('../config/env');
const { randomCode } = require('../utils/helpers');

const ADMIN_PASSWORD = 'Admin@123456';
const ADMIN_POINTS = 1000000n;

const ADMIN_USERS = [
  { email: 'admin1@tikboost.app', password: ADMIN_PASSWORD, role: 'SUPER_ADMIN', name: 'Admin 1' },
  { email: 'admin2@tikboost.app', password: ADMIN_PASSWORD, role: 'ADMIN', name: 'Admin 2' },
  { email: 'admin3@tikboost.app', password: ADMIN_PASSWORD, role: 'ADMIN', name: 'Admin 3' },
  { email: 'admin4@tikboost.app', password: ADMIN_PASSWORD, role: 'ADMIN', name: 'Admin 4' },
  { email: 'admin5@tikboost.app', password: ADMIN_PASSWORD, role: 'MODERATOR', name: 'Admin 5' },
  { email: 'admin6@tikboost.app', password: ADMIN_PASSWORD, role: 'MODERATOR', name: 'Admin 6' },
  { email: 'admin7@tikboost.app', password: ADMIN_PASSWORD, role: 'FINANCE', name: 'Admin 7' },
  { email: 'admin8@tikboost.app', password: ADMIN_PASSWORD, role: 'ADMIN', name: 'Admin 8' },
  { email: 'admin9@tikboost.app', password: ADMIN_PASSWORD, role: 'ADMIN', name: 'Admin 9' },
  { email: 'admin10@tikboost.app', password: ADMIN_PASSWORD, role: 'SUPER_ADMIN', name: 'Admin 10' },
];

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

function buildAvatarUrl(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff3b5c&color=ffffff&bold=true`;
}

async function uniqueReferralCode(preferred) {
  const first = (preferred || '').trim().toUpperCase();
  if (first) {
    const existing = await prisma.user.findUnique({
      where: { referralCode: first },
      select: { id: true },
    });
    if (!existing) return first;
  }

  for (let i = 0; i < 30; i += 1) {
    const code = randomCode(10);
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }

  throw new Error('Failed to generate a unique referral code');
}

async function ensureAdminUsers() {
  const seeded = [];

  for (const adminConfig of ADMIN_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: adminConfig.email },
      select: { id: true, referralCode: true },
    });

    const passwordHash = await bcrypt.hash(adminConfig.password, env.BCRYPT_ROUNDS);
    const referralCode = existing?.referralCode || await uniqueReferralCode();

    const admin = await prisma.user.upsert({
      where: { email: adminConfig.email },
      update: {
        password: passwordHash,
        name: adminConfig.name,
        role: adminConfig.role,
        status: 'ACTIVE',
        avatarUrl: buildAvatarUrl(adminConfig.name),
        referralCode,
        points: ADMIN_POINTS,
        totalEarned: ADMIN_POINTS,
        totalSpent: 0n,
        freezeUntil: null,
        banReason: null,
      },
      create: {
        email: adminConfig.email,
        password: passwordHash,
        name: adminConfig.name,
        role: adminConfig.role,
        status: 'ACTIVE',
        avatarUrl: buildAvatarUrl(adminConfig.name),
        referralCode,
        points: ADMIN_POINTS,
        totalEarned: ADMIN_POINTS,
        totalSpent: 0n,
      },
    });

    seeded.push({
      email: admin.email,
      role: admin.role,
      referralCode: admin.referralCode,
    });
  }

  console.log(`✓ Admin accounts ready: ${seeded.length}`);
  for (const admin of seeded) {
    console.log(`  - ${admin.email} (${admin.role}) referral=${admin.referralCode}`);
  }
}

async function ensureLegacyEnvAdmin() {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD || !env.SEED_ADMIN_NAME) {
    return;
  }

  if (ADMIN_USERS.some((admin) => admin.email === env.SEED_ADMIN_EMAIL)) {
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email: env.SEED_ADMIN_EMAIL },
    select: { id: true, referralCode: true },
  });

  const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, env.BCRYPT_ROUNDS);
  const referralCode = existing?.referralCode || await uniqueReferralCode();

  const admin = await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL },
    update: {
      password: passwordHash,
      name: env.SEED_ADMIN_NAME,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      avatarUrl: buildAvatarUrl(env.SEED_ADMIN_NAME),
      referralCode,
      points: ADMIN_POINTS,
      totalEarned: ADMIN_POINTS,
      totalSpent: 0n,
      freezeUntil: null,
      banReason: null,
    },
    create: {
      email: env.SEED_ADMIN_EMAIL,
      password: passwordHash,
      name: env.SEED_ADMIN_NAME,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      avatarUrl: buildAvatarUrl(env.SEED_ADMIN_NAME),
      referralCode,
      points: ADMIN_POINTS,
      totalEarned: ADMIN_POINTS,
      totalSpent: 0n,
    },
  });

  console.log(`✓ Legacy env admin ready: ${admin.email}`);
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
  console.log(`✓ Packages ready: ${PACKAGES.length}`);
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
  console.log(`✓ Wheel prizes ready: ${WHEEL.length}`);
}

(async () => {
  console.log('▶ Seeding TikBoost core data...');
  await ensureAdminUsers();
  await ensureLegacyEnvAdmin();
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
