const prisma = require('../config/db');
const env = require('../config/env');

const SETTINGS_KEY = 'system_config';

const DEFAULT_SETTINGS = {
  app: {
    name: env.APP_NAME || 'TikBoost',
    tagline: 'اكسب النقاط وروّج لحسابك بسهولة.',
    supportEmail: 'ww608352@gmail.com',
    whatsapp: '213779109990',
    instagramUrl: 'https://www.instagram.com/wh.s.8',
    facebookUrl: 'https://www.facebook.com/profile.php?id=61570663858487',
    privacyUrl: 'https://tikboost.app/privacy',
    downloadUrl: '',
    termsUrl: 'https://tikboost.app/terms',
    logoUrl: '',
    iconUrl: '',
    splashImageUrl: '',
    primaryColor: '#FF3B5C',
    secondaryColor: '#2D7BFF',
    contactLinks: [
      { key: 'whatsapp', label: 'WhatsApp', value: '213779109990', enabled: true },
      { key: 'instagram', label: 'Instagram', value: 'https://www.instagram.com/wh.s.8', enabled: true },
      { key: 'facebook', label: 'Facebook', value: 'https://www.facebook.com/profile.php?id=61570663858487', enabled: true },
      { key: 'email', label: 'Email', value: 'ww608352@gmail.com', enabled: true },
    ],
  },
  ads: {
    bannerEnabled: true,
    interstitialEnabled: true,
    rewardedEnabled: true,
    nativeEnabled: true,
    bannerUnitId: 'ca-app-pub-3940256099942544/6300978111',
    interstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
    rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
    nativeUnitId: 'ca-app-pub-3940256099942544/2247696110',
    autoInterstitialEnabled: true,
    interstitialIntervalMinutes: 20,
    customBannerEnabled: false,
    customBannerImageUrl: '',
    customBannerLinkUrl: '',
    customBannerLabel: 'إعلان',
    excludedUserIds: [],
  },
  rewards: {
    signupBonusPoints: 5000,
    referralBonusPoints: 2500,
    referralNewUserBonusPoints: 0,
    loginRewardPoints: 100,
    dailyRewardAdsLimit: 10,
    pointsPerRewardedAd: 20,
    rewardSessionExpiryMinutes: 15,
  },
  wheel: {
    dailySpinsLimit: 1,
    maxExtraSpinsPerDay: 3,
    confettiThreshold: 250,
  },
  chest: {
    enabled: true,
    rewards: [
      { type: 'points', points: 50, weight: 40, enabled: true },
      { type: 'points', points: 100, weight: 25, enabled: true },
      { type: 'points', points: 250, weight: 16, enabled: true },
      { type: 'extra_spin', extraSpins: 1, weight: 12, enabled: true },
      { type: 'points', points: 500, weight: 7, enabled: true },
    ],
  },
  dailyTasks: {
    items: [
      {
        key: 'login',
        type: 'login',
        title: 'تسجيل الدخول اليومي',
        description: 'افتح التطبيق مرة واحدة يومياً.',
        target: 1,
        rewardPoints: 25,
      },
      {
        key: 'watch_ad',
        type: 'rewarded_ad',
        title: 'مشاهدة إعلان',
        description: 'شاهد إعلاناً مكافئاً مرة واحدة.',
        target: 1,
        rewardPoints: 20,
      },
      {
        key: 'complete_task',
        type: 'complete_task',
        title: 'إكمال مهمة',
        description: 'أكمل مهمة واحدة بنجاح.',
        target: 1,
        rewardPoints: 40,
      },
      {
        key: 'create_campaign',
        type: 'create_campaign',
        title: 'إنشاء حملة',
        description: 'أنشئ حملة جديدة اليوم.',
        target: 1,
        rewardPoints: 35,
      },
      {
        key: 'invite_friend',
        type: 'invite_friend',
        title: 'دعوة صديق',
        description: 'قم بدعوة صديق واحد.',
        target: 1,
        rewardPoints: 75,
      },
      {
        key: 'share_app',
        type: 'manual_share',
        title: 'مشاركة التطبيق',
        description: 'شارك التطبيق يدوياً ثم سجّل المهمة.',
        target: 1,
        rewardPoints: 15,
      },
      {
        key: 'review_app',
        type: 'review_app',
        title: 'قيّم التطبيق ⭐',
        description: 'اكتب تقييماً صادقاً ومفيداً للتطبيق في المتجر ثم سجّل المهمة.',
        target: 1,
        rewardPoints: 250,
        url: '',
      },
    ],
  },
  achievements: {
    items: [
      {
        key: 'tasks_10',
        metric: 'tasks_completed',
        title: 'منجز المهام',
        description: 'أكمل 10 مهام موثقة.',
        target: 10,
        rewardPoints: 200,
      },
      {
        key: 'campaigns_5',
        metric: 'campaigns_created',
        title: 'مدير الحملات',
        description: 'أنشئ 5 حملات.',
        target: 5,
        rewardPoints: 250,
      },
      {
        key: 'purchase_1',
        metric: 'purchases_approved',
        title: 'أول عملية شراء',
        description: 'أكمل أول عملية شراء ناجحة.',
        target: 1,
        rewardPoints: 300,
      },
      {
        key: 'referrals_3',
        metric: 'referrals_count',
        title: 'سفير التطبيق',
        description: 'ادع 3 أصدقاء.',
        target: 3,
        rewardPoints: 350,
      },
    ],
  },
  levels: {
    xp: {
      taskRewardXp: 8,
      campaignCreateXp: 12,
      purchaseXp: 25,
      referralXp: 30,
    },
    definitions: [
      { key: 'bronze', name: 'Bronze', minXp: 0, multiplier: 1, icon: '🥉' },
      { key: 'silver', name: 'Silver', minXp: 250, multiplier: 1.05, icon: '🥈' },
      { key: 'gold', name: 'Gold', minXp: 700, multiplier: 1.1, icon: '🥇' },
      { key: 'platinum', name: 'Platinum', minXp: 1400, multiplier: 1.15, icon: '💎' },
    ],
  },
  campaignPricing: {
    FOLLOWERS: 100,
    LIKES: 20,
    VIEWS: 5,
    COMMENTS: 50,
  },
  campaignRewards: {
    FOLLOWERS: 80,
    LIKES: 16,
    VIEWS: 4,
    COMMENTS: 40,
  },
  campaignRules: {
    minQuantity: 10,
    maxQuantity: 100000,
  },
  payments: {
    methods: [
      {
        key: 'manual_transfer',
        label: 'Manual Transfer',
        enabled: true,
        instructions: 'حوّل المبلغ ثم أرسل إثبات التحويل للدعم للمراجعة.',
        walletAddress: '',
      },
      {
        key: 'usdt_trc20',
        label: 'USDT TRC20',
        enabled: false,
        instructions: '',
        walletAddress: '',
      },
    ],
  },
  notifications: {
    enabled: true,
    reminderEnabled: true,
    reminderAfterHours: 24,
    reviewPromptEnabled: true,
    reviewRewardPoints: 250,
    reviewUrl: '',
    reviewTitle: 'قيّم TikBoost ⭐',
    reviewBody: 'شاركنا تقييمك الجميل في المتجر واحصل على نقاط إضافية.',
    reviewSnoozeHours: 48,
  },
  vipPro: {
    enabled: true,
    monthlyPriceCents: 1000,
    currency: 'USD',
    bonusPerTask: 5,
    priorityBoost: true,
  },
  features: {
    enableGoogleLogin: env.ENABLE_GOOGLE_LOGIN,
    allowLegacyPasswordReset: env.ENABLE_LEGACY_PASSWORD_RESET,
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

function clampFloat(value, min, max, fallback) {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}

function normalizeString(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}


function normalizeUrl(value, fallback = '') {
  return normalizeString(value, fallback);
}

function normalizeWhatsapp(value, fallback = '') {
  const text = normalizeString(value, fallback);
  if (!text) return '';
  const waMatch = text.match(/wa\.me\/(\d+)/i);
  if (waMatch?.[1]) return waMatch[1];
  const digits = text.replace(/\D/g, '');
  return digits || text;
}

function buildContactLinks(app = {}) {
  // Preserve administrator-defined links. Legacy fields are used only as fallback.
  if (Array.isArray(app.contactLinks) && app.contactLinks.length) {
    return normalizeContactLinks(app.contactLinks);
  }

  const whatsapp = normalizeWhatsapp(app.whatsapp, DEFAULT_SETTINGS.app.whatsapp);
  const instagramUrl = normalizeUrl(app.instagramUrl, DEFAULT_SETTINGS.app.instagramUrl);
  const facebookUrl = normalizeUrl(app.facebookUrl, DEFAULT_SETTINGS.app.facebookUrl);
  const supportEmail = normalizeString(app.supportEmail, DEFAULT_SETTINGS.app.supportEmail);

  return normalizeContactLinks([
    { key: 'whatsapp', label: 'WhatsApp', value: whatsapp, enabled: whatsapp.length > 0 },
    { key: 'instagram', label: 'Instagram', value: instagramUrl, enabled: instagramUrl.length > 0 },
    { key: 'facebook', label: 'Facebook', value: facebookUrl, enabled: facebookUrl.length > 0 },
    { key: 'email', label: 'Email', value: supportEmail, enabled: supportEmail.length > 0 },
  ]);
}

function normalizeCampaignPricing(pricing = {}) {
  const current = { ...DEFAULT_SETTINGS.campaignPricing, ...(pricing || {}) };
  return {
    FOLLOWERS: clampInt(current.FOLLOWERS, 1, 1000000, DEFAULT_SETTINGS.campaignPricing.FOLLOWERS),
    LIKES: clampInt(current.LIKES, 1, 1000000, DEFAULT_SETTINGS.campaignPricing.LIKES),
    VIEWS: clampInt(current.VIEWS, 1, 1000000, DEFAULT_SETTINGS.campaignPricing.VIEWS),
    COMMENTS: clampInt(current.COMMENTS, 1, 1000000, DEFAULT_SETTINGS.campaignPricing.COMMENTS),
  };
}

function normalizeCampaignRewards(rewards = {}) {
  const current = { ...DEFAULT_SETTINGS.campaignRewards, ...(rewards || {}) };
  return {
    FOLLOWERS: clampInt(current.FOLLOWERS, 1, 1000000, DEFAULT_SETTINGS.campaignRewards.FOLLOWERS),
    LIKES: clampInt(current.LIKES, 1, 1000000, DEFAULT_SETTINGS.campaignRewards.LIKES),
    VIEWS: clampInt(current.VIEWS, 1, 1000000, DEFAULT_SETTINGS.campaignRewards.VIEWS),
    COMMENTS: clampInt(current.COMMENTS, 1, 1000000, DEFAULT_SETTINGS.campaignRewards.COMMENTS),
  };
}

function normalizeCampaignRules(rules = {}) {
  const minQuantity = clampInt(rules.minQuantity, 1, 1000000, DEFAULT_SETTINGS.campaignRules.minQuantity);
  const maxQuantity = clampInt(rules.maxQuantity, minQuantity, 1000000, DEFAULT_SETTINGS.campaignRules.maxQuantity);
  return { minQuantity, maxQuantity };
}

function normalizePaymentMethods(methods) {
  const list = Array.isArray(methods) ? methods : DEFAULT_SETTINGS.payments.methods;
  const normalized = list
    .map((method, index) => ({
      key: normalizeString(method?.key, `method_${index + 1}`).toLowerCase(),
      label: normalizeString(method?.label, normalizeString(method?.key, `Method ${index + 1}`)),
      enabled: normalizeBool(method?.enabled, true),
      instructions: normalizeString(method?.instructions, ''),
      walletAddress: normalizeString(method?.walletAddress, ''),
    }))
    .filter((method) => method.key && method.label);

  return normalized.length ? normalized : DEFAULT_SETTINGS.payments.methods.slice();
}

function normalizeContactLinks(links) {
  const list = Array.isArray(links) ? links : DEFAULT_SETTINGS.app.contactLinks;
  const normalized = list
    .slice(0, 30)
    .map((item, index) => ({
      key: normalizeString(item?.key, `contact_${index + 1}`).toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      label: normalizeString(item?.label, normalizeString(item?.key, `Contact ${index + 1}`)),
      value: normalizeString(item?.value, ''),
      enabled: normalizeBool(item?.enabled, true),
    }))
    .filter((item) => item.key && item.label && item.value);
  return normalized.length ? normalized : DEFAULT_SETTINGS.app.contactLinks.slice();
}

function normalizeLevelDefinitions(definitions) {
  const list = Array.isArray(definitions) ? definitions : DEFAULT_SETTINGS.levels.definitions;
  return list
    .map((item, index) => ({
      key: normalizeString(item?.key, `level_${index + 1}`),
      name: normalizeString(item?.name, `Level ${index + 1}`),
      minXp: clampInt(item?.minXp, 0, 100000000, index === 0 ? 0 : 100 * index),
      multiplier: clampFloat(item?.multiplier, 1, 5, 1),
      icon: normalizeString(item?.icon, '⭐'),
    }))
    .sort((a, b) => a.minXp - b.minXp);
}

function normalizeTaskItems(items) {
  const list = Array.isArray(items) ? items : DEFAULT_SETTINGS.dailyTasks.items;
  return list
    .map((item) => ({
      key: normalizeString(item?.key),
      type: normalizeString(item?.type, 'manual_share'),
      title: normalizeString(item?.title, 'Task'),
      description: normalizeString(item?.description, ''),
      target: clampInt(item?.target, 1, 1000, 1),
      rewardPoints: clampInt(item?.rewardPoints, 0, 1000000, 0),
    }))
    .filter((item) => item.key);
}

function normalizeAchievementItems(items) {
  const list = Array.isArray(items) ? items : DEFAULT_SETTINGS.achievements.items;
  return list
    .map((item) => ({
      key: normalizeString(item?.key),
      metric: normalizeString(item?.metric, 'tasks_completed'),
      title: normalizeString(item?.title, 'Achievement'),
      description: normalizeString(item?.description, ''),
      target: clampInt(item?.target, 1, 1000000, 1),
      rewardPoints: clampInt(item?.rewardPoints, 0, 1000000, 0),
    }))
    .filter((item) => item.key);
}

function normalizeChestRewards(items) {
  const list = Array.isArray(items) ? items : DEFAULT_SETTINGS.chest.rewards;
  return list
    .map((item) => ({
      type: normalizeString(item?.type, 'points'),
      points: clampInt(item?.points, 0, 1000000, 0),
      extraSpins: clampInt(item?.extraSpins, 0, 10, 0),
      weight: clampInt(item?.weight, 1, 1000, 1),
      enabled: normalizeBool(item?.enabled, true),
    }))
    .filter((item) => item.type === 'points' || item.type === 'extra_spin');
}

function normalizeSettings(input) {
  const merged = mergeDeep(DEFAULT_SETTINGS, input || {});

  merged.app.name = normalizeString(merged.app.name, DEFAULT_SETTINGS.app.name);
  merged.app.tagline = normalizeString(merged.app.tagline, DEFAULT_SETTINGS.app.tagline);
  merged.app.supportEmail = normalizeString(merged.app.supportEmail, DEFAULT_SETTINGS.app.supportEmail);
  merged.app.whatsapp = normalizeWhatsapp(merged.app.whatsapp, DEFAULT_SETTINGS.app.whatsapp);
  merged.app.instagramUrl = normalizeUrl(merged.app.instagramUrl, DEFAULT_SETTINGS.app.instagramUrl);
  merged.app.facebookUrl = normalizeUrl(merged.app.facebookUrl, DEFAULT_SETTINGS.app.facebookUrl);
  merged.app.privacyUrl = normalizeString(merged.app.privacyUrl, DEFAULT_SETTINGS.app.privacyUrl);
  merged.app.downloadUrl = normalizeUrl(merged.app.downloadUrl, DEFAULT_SETTINGS.app.downloadUrl);
  merged.app.termsUrl = normalizeString(merged.app.termsUrl, DEFAULT_SETTINGS.app.termsUrl);
  merged.app.logoUrl = normalizeString(merged.app.logoUrl, DEFAULT_SETTINGS.app.logoUrl);
  merged.app.iconUrl = normalizeString(merged.app.iconUrl, DEFAULT_SETTINGS.app.iconUrl);
  merged.app.splashImageUrl = normalizeString(merged.app.splashImageUrl, DEFAULT_SETTINGS.app.splashImageUrl);
  merged.app.primaryColor = normalizeString(merged.app.primaryColor, DEFAULT_SETTINGS.app.primaryColor);
  merged.app.secondaryColor = normalizeString(merged.app.secondaryColor, DEFAULT_SETTINGS.app.secondaryColor);
  merged.app.contactLinks = buildContactLinks(merged.app);

  merged.ads.bannerEnabled = normalizeBool(merged.ads.bannerEnabled, DEFAULT_SETTINGS.ads.bannerEnabled);
  merged.ads.interstitialEnabled = normalizeBool(merged.ads.interstitialEnabled, DEFAULT_SETTINGS.ads.interstitialEnabled);
  merged.ads.rewardedEnabled = normalizeBool(merged.ads.rewardedEnabled, DEFAULT_SETTINGS.ads.rewardedEnabled);
  merged.ads.nativeEnabled = normalizeBool(merged.ads.nativeEnabled, DEFAULT_SETTINGS.ads.nativeEnabled);
  merged.ads.bannerUnitId = normalizeString(merged.ads.bannerUnitId, DEFAULT_SETTINGS.ads.bannerUnitId);
  merged.ads.interstitialUnitId = normalizeString(merged.ads.interstitialUnitId, DEFAULT_SETTINGS.ads.interstitialUnitId);
  merged.ads.rewardedUnitId = normalizeString(merged.ads.rewardedUnitId, DEFAULT_SETTINGS.ads.rewardedUnitId);
  merged.ads.nativeUnitId = normalizeString(merged.ads.nativeUnitId, DEFAULT_SETTINGS.ads.nativeUnitId);
  merged.ads.autoInterstitialEnabled = normalizeBool(merged.ads.autoInterstitialEnabled, DEFAULT_SETTINGS.ads.autoInterstitialEnabled);
  merged.ads.interstitialIntervalMinutes = clampInt(merged.ads.interstitialIntervalMinutes, 1, 1440, DEFAULT_SETTINGS.ads.interstitialIntervalMinutes);
  merged.ads.customBannerEnabled = normalizeBool(merged.ads.customBannerEnabled, DEFAULT_SETTINGS.ads.customBannerEnabled);
  merged.ads.customBannerImageUrl = normalizeUrl(merged.ads.customBannerImageUrl, DEFAULT_SETTINGS.ads.customBannerImageUrl);
  merged.ads.customBannerLinkUrl = normalizeUrl(merged.ads.customBannerLinkUrl, DEFAULT_SETTINGS.ads.customBannerLinkUrl);
  merged.ads.customBannerLabel = normalizeString(merged.ads.customBannerLabel, DEFAULT_SETTINGS.ads.customBannerLabel);
  merged.ads.excludedUserIds = Array.isArray(merged.ads.excludedUserIds)
    ? [...new Set(merged.ads.excludedUserIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 5000)
    : [];

  merged.rewards.signupBonusPoints = clampInt(merged.rewards.signupBonusPoints, 0, 1000000, DEFAULT_SETTINGS.rewards.signupBonusPoints);
  merged.rewards.referralBonusPoints = clampInt(merged.rewards.referralBonusPoints, 0, 1000000, DEFAULT_SETTINGS.rewards.referralBonusPoints);
  merged.rewards.referralNewUserBonusPoints = clampInt(merged.rewards.referralNewUserBonusPoints, 0, 1000000, DEFAULT_SETTINGS.rewards.referralNewUserBonusPoints);
  merged.rewards.loginRewardPoints = clampInt(merged.rewards.loginRewardPoints, 0, 1000000, DEFAULT_SETTINGS.rewards.loginRewardPoints);
  merged.rewards.dailyRewardAdsLimit = clampInt(merged.rewards.dailyRewardAdsLimit, 1, 100, DEFAULT_SETTINGS.rewards.dailyRewardAdsLimit);
  merged.rewards.pointsPerRewardedAd = clampInt(merged.rewards.pointsPerRewardedAd, 1, 100000, DEFAULT_SETTINGS.rewards.pointsPerRewardedAd);
  merged.rewards.rewardSessionExpiryMinutes = clampInt(merged.rewards.rewardSessionExpiryMinutes, 1, 120, DEFAULT_SETTINGS.rewards.rewardSessionExpiryMinutes);

  merged.wheel.dailySpinsLimit = clampInt(merged.wheel.dailySpinsLimit, 1, 20, DEFAULT_SETTINGS.wheel.dailySpinsLimit);
  merged.wheel.maxExtraSpinsPerDay = clampInt(merged.wheel.maxExtraSpinsPerDay, 0, 20, DEFAULT_SETTINGS.wheel.maxExtraSpinsPerDay);
  merged.wheel.confettiThreshold = clampInt(merged.wheel.confettiThreshold, 0, 1000000, DEFAULT_SETTINGS.wheel.confettiThreshold);

  merged.chest.enabled = normalizeBool(merged.chest.enabled, DEFAULT_SETTINGS.chest.enabled);
  merged.chest.rewards = normalizeChestRewards(merged.chest.rewards);

  merged.dailyTasks.items = normalizeTaskItems(merged.dailyTasks.items);
  merged.achievements.items = normalizeAchievementItems(merged.achievements.items);
  merged.levels.xp.taskRewardXp = clampInt(merged.levels?.xp?.taskRewardXp, 0, 1000, DEFAULT_SETTINGS.levels.xp.taskRewardXp);
  merged.levels.xp.campaignCreateXp = clampInt(merged.levels?.xp?.campaignCreateXp, 0, 1000, DEFAULT_SETTINGS.levels.xp.campaignCreateXp);
  merged.levels.xp.purchaseXp = clampInt(merged.levels?.xp?.purchaseXp, 0, 1000, DEFAULT_SETTINGS.levels.xp.purchaseXp);
  merged.levels.xp.referralXp = clampInt(merged.levels?.xp?.referralXp, 0, 1000, DEFAULT_SETTINGS.levels.xp.referralXp);
  merged.levels.definitions = normalizeLevelDefinitions(merged.levels.definitions);

  merged.campaignPricing = normalizeCampaignPricing(merged.campaignPricing);
  merged.campaignRewards = normalizeCampaignRewards(merged.campaignRewards);
  merged.campaignRules = normalizeCampaignRules(merged.campaignRules);
  merged.payments.methods = normalizePaymentMethods(merged.payments?.methods);
  merged.notifications.enabled = normalizeBool(merged.notifications?.enabled, DEFAULT_SETTINGS.notifications.enabled);
  merged.features.enableGoogleLogin = normalizeBool(merged.features.enableGoogleLogin, DEFAULT_SETTINGS.features.enableGoogleLogin);
  merged.features.allowLegacyPasswordReset = normalizeBool(merged.features.allowLegacyPasswordReset, DEFAULT_SETTINGS.features.allowLegacyPasswordReset);

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
  normalizeCampaignPricing,
  normalizeCampaignRewards,
  normalizeCampaignRules,
  normalizePaymentMethods,
  getSettings,
  updateSettings,
  getOrCreateDailyUsage,
};
