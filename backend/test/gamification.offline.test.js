/*
 * Offline test for levels / missions logic.
 * Uses an in-memory fake of the Prisma client so it runs without a database:
 *   node tests/gamification.test.js
 * It exercises the REAL gamification + settings code paths (status building,
 * level ladder, level-reward claim, double-claim protection).
 */
const Module = require('module');
const assert = require('assert');
const path = require('path');

// ---- in-memory fake Prisma --------------------------------------------------
const fake = { totalEarned: 0n };
const store = { appSetting: new Map(), userState: new Map() };
function fakeModel(name) {
  return new Proxy({}, {
    get: (_t, method) => async (args = {}) => {
      if (name === 'appSetting') {
        if (method === 'findUnique') return store.appSetting.get(args.where.key) || null;
        if (method === 'create') { store.appSetting.set(args.data.key, { ...args.data }); return args.data; }
        if (method === 'upsert') { store.appSetting.set(args.where.key, { key: args.where.key, valueJson: (args.update || args.create).valueJson }); return args.update; }
      }
      if (name === 'user' && (method === 'findUnique' || method === 'findFirst')) return { id: 'user-1', points: 0n, totalEarned: fake.totalEarned, totalSpent: 0n, role: 'USER', createdAt: new Date(), vipTier: null };
      if (method === 'count') return 0;
      if (method === 'findMany') return [];
      if (method === 'aggregate') return { _sum: {}, _count: 0 };
      if (method === 'groupBy') return [];
      if (method === 'findFirst' || method === 'findUnique') return null;
      return args.data || args.create || {};
    },
  });
}
const prismaFake = new Proxy({}, {
  get: (_t, prop) => {
    if (prop === '$transaction') return async (fn) => fn(prismaFake);
    if (prop === '$executeRaw' || prop === '$queryRaw') return async () => 0;
    return fakeModel(String(prop));
  },
});
let granted = [];
const stubs = {
  dotenv: { config() {} },
  '../config/db': prismaFake,
  './points.service': { adjustPoints: async (u, amt, type, meta) => { granted.push({ u, amt: Number(amt), type, meta }); return { points: 1000n }; } },
  './notifications.service': { notify: async () => {} },
};
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  for (const key of Object.keys(stubs)) if (request === key || request.endsWith(key.replace('./', '/'))) {
    return stubs[key];
  }
  return origLoad.apply(this, arguments);
};

(async () => {
  const settingsSvc = require('../src/services/appSettings.service');
  const g = require('../src/services/gamification.service');
  let passed = 0; const ok = (c, m) => { assert.ok(c, m); passed++; console.log('  ✓', m); };

  const settings = await settingsSvc.getSettings();
  const defs = settings.levels.definitions;
  ok(defs.length === 8, 'default settings contain 8 levels');
  ok(defs.every((d) => typeof d.rewardPoints === 'number'), 'every level keeps rewardPoints after normalisation');
  ok(settings.dailyTasks.items.some((t) => t.key === 'spin_wheel') && settings.dailyTasks.items.some((t) => t.key === 'open_chest'), 'new daily tasks (spin_wheel, open_chest) survive normalisation');
  ok(settings.dailyTasks.items.every((t) => 'titleEn' in t && 'titleFr' in t), 'task translations (titleEn/titleFr) are kept');
  ok(settings.app.announcement && settings.app.maintenance, 'announcement + maintenance settings exist');

  const profile = await g.buildGamificationProfile('user-1');
  ok(profile.level && profile.level.key === 'bronze', 'new user starts at Bronze');
  const levels = g.buildLevelsStatus(profile.settings, profile.xp, profile.state);
  ok(levels.length === 8 && levels[0].reached && !levels[1].reached, 'level ladder: Bronze reached, Silver locked at 0 XP');
  ok(levels.filter((l) => l.claimable).length === 0, 'nothing claimable at 0 XP');

  const high = g.buildLevelsStatus(profile.settings, 800, profile.state); // >= Gold (700)
  ok(high.filter((l) => l.claimable).map((l) => l.key).join() === 'silver,gold', 'at 800 XP Silver and Gold rewards are claimable');
  ok(g.computeLevelInfo(profile.settings, 800).key === 'gold', 'computeLevelInfo(800) = gold');

  const daily = g.buildDailyTaskStatus(profile.settings, { wheelDailySpinsUsed: 0, wheelExtraSpinsUsed: 0 }, profile.state, { tasksCompleted: 0, campaignsCreated: 0, adsWatched: 0, referrals: 0 });
  ok(Array.isArray(daily) && daily.length >= 7, 'daily task status builds (' + daily.length + ' tasks)');
  const sw = daily.find((t) => t.key === 'spin_wheel');
  ok(sw && sw.progress === 0 && sw.completed === false, 'spin_wheel task starts at 0/1');

  const weekly = g.buildWeeklyChallengeStatus(profile.settings, profile.counters, profile.state);
  ok(Array.isArray(weekly) && weekly.length >= 4, 'weekly challenges build (' + weekly.length + ')');

  // ---- claim logic ---------------------------------------------------------
  let threw = null;
  try { await g.claimLevelReward('user-1', 'silver'); } catch (e) { threw = e; }
  ok(threw && /not reached/i.test(threw.message), 'claiming an unreached level is rejected');
  threw = null;
  try { await g.claimLevelReward('user-1', 'nope'); } catch (e) { threw = e; }
  ok(threw && /not found/i.test(threw.message), 'claiming an unknown level is rejected');
  ok(granted.length === 0, 'rejected claims grant no points');

  fake.totalEarned = 100000n; // XP grows with lifetime earnings, so this clears several levels
  const rich = await g.buildGamificationProfile('user-1');
  const richLevels = g.buildLevelsStatus(rich.settings, rich.xp, rich.state);
  const claimable = richLevels.filter((l) => l.claimable);
  ok(rich.xp >= 250 && claimable.length >= 1, 'with 100000 earned: xp=' + rich.xp + ', claimable levels=' + claimable.map((l) => l.key).join(','));

  const key = claimable[0].key;
  const r1 = await g.claimLevelReward('user-1', key);
  ok(granted.length === 1 && granted[0].amt === claimable[0].rewardPoints && Number(r1.rewardPoints) === claimable[0].rewardPoints, 'claim grants exactly the level reward (' + claimable[0].rewardPoints + ')');
  threw = null;
  try { await g.claimLevelReward('user-1', key); } catch (e) { threw = e; }
  ok(threw && /already claimed/i.test(threw.message) && granted.length === 1, 'second claim of the same level is rejected (no double reward)');
  const after = await g.buildGamificationProfile('user-1');
  const afterLevels = g.buildLevelsStatus(after.settings, after.xp, after.state);
  ok(afterLevels.find((l) => l.key === key).claimed === true, 'claimed level is marked claimed in the next status');

  console.log('\n' + passed + ' checks passed');
})().catch((e) => { console.error('FAILED:', e && e.stack || e); process.exit(1); });
