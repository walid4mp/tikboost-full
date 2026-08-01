const prisma = require('../config/db');

const SETTINGS_KEY = 'system_config';

const DEFAULT_SETTINGS = {
  rewards: {
    dailyRewardAdsLimit: 10,
    pointsPerRewardedAd: 20,
    rewardSessionExpiryMinutes: 15,
  },
  wheel: {
    dailySpinsLimit: 3,
    maxExtraSpinsPerDay: 3,
    confettiThreshold: 250,
  },
};

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function mergeDeep(target, source) {
  if (Array.isArray(source)) return source.slice();
  if (!source || typeof source !== 'object') return source;

  const out = { ...(target || {}) };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeDeep(out[key] || {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeSettings(input) {
  const merged = mergeDeep(DEFAULT_SETTINGS, input || {});

  merged.rewards.dailyRewardAdsLimit = clampInt(
    merged.rewards.dailyRewardAdsLimit,
    1,
    100,
    DEFAULT_SETTINGS.rewards.dailyRewardAdsLimit,
  );
  merged.rewards.pointsPerRewardedAd = clampInt(
    merged.rewards.pointsPerRewardedAd,
    1,
    100000,
    DEFAULT_SETTINGS.rewards.pointsPerRewardedAd,
  );
  merged.rewards.rewardSessionExpiryMinutes = clampInt(
    merged.rewards.rewardSessionExpiryMinutes,
    1,
    120,
    DEFAULT_SETTINGS.rewards.rewardSessionExpiryMinutes,
  );

  merged.wheel.dailySpinsLimit = clampInt(
    merged.wheel.dailySpinsLimit,
    1,
    20,
    DEFAULT_SETTINGS.wheel.dailySpinsLimit,
  );
  merged.wheel.maxExtraSpinsPerDay = clampInt(
    merged.wheel.maxExtraSpinsPerDay,
    0,
    20,
    DEFAULT_SETTINGS.wheel.maxExtraSpinsPerDay,
  );
  merged.wheel.confettiThreshold = clampInt(
    merged.wheel.confettiThreshold,
    0,
    1000000,
    DEFAULT_SETTINGS.wheel.confettiThreshold,
  );

  return merged;
}

async function getSettings(client = prisma) {
  const row = await client.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) {
    const created = await client.appSetting.create({
      data: { key: SETTINGS_KEY, valueJson: DEFAULT_SETTINGS },
    });
    return normalizeSettings(created.valueJson || {});
  }
  return normalizeSettings(row.valueJson || {});
}

async function updateSettings(patch, client = prisma) {
  const current = await getSettings(client);
  const next = normalizeSettings(mergeDeep(current, patch || {}));
  await client.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { valueJson: next },
    create: { key: SETTINGS_KEY, valueJson: next },
  });
  return next;
}

async function getOrCreateDailyUsage(userId, client = prisma, dayKey = startOfUtcDay()) {
  return client.dailyUsage.upsert({
    where: { userId_dayKey: { userId, dayKey } },
    update: {},
    create: { userId, dayKey },
  });
}

module.exports = {
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  startOfUtcDay,
  mergeDeep,
  normalizeSettings,
  getSettings,
  updateSettings,
  getOrCreateDailyUsage,
};
