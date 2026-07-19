/* Seed script:
 *  - Ensures DB schema is migrated: `npx prisma db push`
 *  - Seeds: super admin, point packages, wheel prizes, referral codes
 */
const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const env = require('../config/env');

const PACKAGES = [
  { slug: 'starter', name: 'Starter',  priceCents: 100,  points: 100000n,    bonusPoints: 0n,     sortOrder: 1 },
  { slug: 'basic',   name: 'Basic',    priceCents: 500,  points: 500000n,    bonusPoints: 50000n, sortOrder: 2 },
  { slug: 'pro',     name: 'Pro',      priceCents: 1000, points: 1000000n,   bonusPoints: 120000n, sortOrder: 3 },
  { slug: 'elite',   name: 'Elite',    priceCents: 2500, points: 2800000n,   bonusPoints: 400000n, sortOrder: 4 },
  { slug: 'vip',     name: 'VIP',      priceCents: 5000, points: 6000000n,   bonusPoints: 1000000n, sortOrder: 5 },
];

const WHEEL = [
  { label: '500',     points: 500n,     weight: 35, color: '#9ca3af', sortOrder: 0 },
  { label: '1,000',   points: 1000n,    weight: 25, color: '#22c55e', sortOrder: 1 },
  { label: '2,500',   points: 2500n,    weight: 15, color: '#3b82f6', sortOrder: 2 },
  { label: '5,000',   points: 5000n,    weight: 10, color: '#a855f7', sortOrder: 3 },
  { label: '10,000',  points: 10000n,   weight: 8,  color: '#f59e0b', sortOrder: 4 },
  { label: '25,000',  points: 25000n,   weight: 4,  color: '#ef4444', sortOrder: 5 },
  { label: '50,000',  points: 50000n,   weight: 2,  color: '#ec4899', sortOrder: 6 },
  { label: '100,000', points: 100000n,  weight: 1,  color: '#ffd700', sortOrder: 7 },
];

(async () => {
  console.log('▶ Seeding…');

  const hash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, env.BCRYPT_ROUNDS);
  const code = 'ADMIN' + Math.floor(Math.random() * 1e6);
  const admin = await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL },
    update: {},
    create: {
      email: env.SEED_ADMIN_EMAIL,
      password: hash,
      name: env.SEED_ADMIN_NAME,
      role: 'SUPER_ADMIN',
      referralCode: code,
      points: 0n, totalEarned: 0n, totalSpent: 0n,
    },
  });
  console.log('✓ Admin:', admin.email, '(password loaded from env)');

  for (const p of PACKAGES) {
    await prisma.pointPackage.upsert({
      where: { slug: p.slug }, update: { priceCents: p.priceCents, points: p.points, bonusPoints: p.bonusPoints },
      create: p,
    });
  }
  console.log('✓ Packages:', PACKAGES.length);

  // Wheel prizes
  const existing = await prisma.wheelPrize.count();
  if (existing === 0) {
    for (const w of WHEEL) await prisma.wheelPrize.create({ data: w });
    console.log('✓ Wheel prizes:', WHEEL.length);
  }

  console.log('✔ Done.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
