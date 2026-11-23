const prisma = require('../config/db');
const env = require('../config/env');

const SETTINGS_KEY = 'system_config';

const DEFAULT_SETTINGS = {
  app: {
    name: env.APP_NAME || 'tikboost.wh',
    tagline: 'اكسب النقاط وروّج لحسابك بسهولة.',
    supportEmail: 'ww608352@gmail.com',
    whatsapp: 'https://wa.me/message/VT2BBC7YZ4LHP1',
    tiktokUrl: 'https://www.tiktok.com/@whsto.official',
    instagramUrl: 'https://www.instagram.com/whsto.official/',
    facebookUrl: 'https://www.facebook.com/whsto.official',
    privacyUrl: 'https://WHSTO.com/tikboost/privacy/',
    downloadUrl: '',
    termsUrl: 'https://WHSTO.com/tikboost/terms/',
    logoUrl: '',
    iconUrl: '',
    splashImageUrl: '',
    primaryColor: '#FF3B5C',
    secondaryColor: '#2D7BFF',
    announcement: { enabled: false, level: 'info', text: '', textEn: '', textFr: '', url: '' },
    maintenance: { enabled: false, message: '', messageEn: '', messageFr: '' },
    contactLinks: [
      { key: 'whatsapp', label: 'WhatsApp', value: 'https://wa.me/message/VT2BBC7YZ4LHP1', enabled: true },
      { key: 'tiktok', label: 'TikTok', value: 'https://www.tiktok.com/@whsto.official', enabled: true },
      { key: 'instagram', label: 'Instagram', value: 'https://www.instagram.com/whsto.official/', enabled: true },
      { key: 'facebook', label: 'Facebook', value: 'https://www.facebook.com/whsto.official', enabled: true },
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
    followMilestoneAdEnabled: true,
    followMilestoneCount: 10,
    followMilestoneAdType: 'INTERSTITIAL',
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
        titleEn: 'Daily sign-in',
        titleFr: 'Connexion quotidienne',
        descriptionEn: 'Open the app once a day.',
        descriptionFr: 'Ouvrez l\'application une fois par jour.',
        title: 'تسجيل الدخول اليومي',
        description: 'افتح التطبيق مرة واحدة يومياً.',
        target: 1,
        rewardPoints: 25,
      },
      {
        key: 'watch_ad',
        type: 'rewarded_ad',
        titleEn: 'Watch an ad',
        titleFr: 'Regarder une publicité',
        descriptionEn: 'Watch one rewarded ad.',
        descriptionFr: 'Regardez une publicité récompensée.',
        title: 'مشاهدة إعلان',
        description: 'شاهد إعلاناً مكافئاً مرة واحدة.',
        target: 1,
        rewardPoints: 20,
      },
      {
        key: 'complete_task',
        type: 'complete_task',
        titleEn: 'Complete a task',
        titleFr: 'Terminer une tâche',
        descriptionEn: 'Complete one task successfully.',
        descriptionFr: 'Terminez une tâche avec succès.',
        title: 'إكمال مهمة',
        description: 'أكمل مهمة واحدة بنجاح.',
        target: 1,
        rewardPoints: 40,
      },
      {
        key: 'create_campaign',
        type: 'create_campaign',
        titleEn: 'Create a campaign',
        titleFr: 'Créer une campagne',
        descriptionEn: 'Create a new campaign today.',
        descriptionFr: 'Créez une nouvelle campagne aujourd\'hui.',
        title: 'إنشاء حملة',
        description: 'أنشئ حملة جديدة اليوم.',
        target: 1,
        rewardPoints: 35,
      },
      {
        key: 'invite_friend',
        type: 'invite_friend',
        titleEn: 'Invite a friend',
        titleFr: 'Inviter un ami',
        descriptionEn: 'Invite one friend.',
        descriptionFr: 'Invitez un ami.',
        title: 'دعوة صديق',
        description: 'قم بدعوة صديق واحد.',
        target: 1,
        rewardPoints: 75,
      },
      {
        key: 'share_app',
        type: 'manual_share',
        titleEn: 'Share the app',
        titleFr: 'Partager l\'application',
        descriptionEn: 'Share the app manually, then log the task.',
        descriptionFr: 'Partagez l\'application puis enregistrez la tâche.',
        title: 'مشاركة التطبيق',
        description: 'شارك التطبيق يدوياً ثم سجّل المهمة.',
        target: 1,
        rewardPoints: 15,
      },
      {
        key: 'review_app',
        type: 'review_app',
        titleEn: 'Rate the app ⭐',
        titleFr: 'Noter l\'application ⭐',
        descriptionEn: 'Write an honest, helpful review in the store, then log the task.',
        descriptionFr: 'Rédigez un avis honnête et utile dans la boutique puis enregistrez la tâche.',
        title: 'قيّم التطبيق ⭐',
        description: 'اكتب تقييماً صادقاً ومفيداً للتطبيق في المتجر ثم سجّل المهمة.',
        target: 1,
        rewardPoints: 250,
        url: '',
      },
      {
        key: 'spin_wheel',
        type: 'spin_wheel',
        title: 'لف عجلة الحظ',
        description: 'لف عجلة الحظ مرة واحدة اليوم.',
        titleEn: 'Spin the lucky wheel',
        titleFr: 'Tourner la roue de la chance',
        descriptionEn: 'Spin the lucky wheel once today.',
        descriptionFr: 'Tournez la roue de la chance une fois aujourd\'hui.',
        target: 1,
        rewardPoints: 30,
      },
      {
        key: 'open_chest',
        type: 'open_chest',
        title: 'افتح الصندوق اليومي',
        description: 'افتح صندوق المكافآت اليومي.',
        titleEn: 'Open the daily chest',
        titleFr: 'Ouvrir le coffre quotidien',
        descriptionEn: 'Open your daily reward chest.',
        descriptionFr: 'Ouvrez votre coffre de récompenses quotidien.',
        target: 1,
        rewardPoints: 20,
      },
    ],
  },
  engagement: {
    streakEnabled: true,
    streakRewards: [25, 35, 50, 70, 100, 140, 200],
    comebackEnabled: true,
    comebackAfterDays: 3,
    comebackRewardPoints: 120,
    weeklyEnabled: true,
    weeklyResetDay: 'MONDAY',
    weeklyChallenges: [
      { key: 'weekly_tasks_10', type: 'tasks_completed', title: 'محترف النشاط', description: 'أكمل 10 مهام هذا الأسبوع.', titleEn: 'Activity pro', titleFr: 'Pro de l\'activité', descriptionEn: 'Complete 10 tasks this week.', descriptionFr: 'Terminez 10 tâches cette semaine.', target: 10, rewardPoints: 180 },
      { key: 'weekly_tasks_25', type: 'tasks_completed', title: 'نجم الأسبوع', description: 'أكمل 25 مهمة هذا الأسبوع.', titleEn: 'Star of the week', titleFr: 'Star de la semaine', descriptionEn: 'Complete 25 tasks this week.', descriptionFr: 'Terminez 25 tâches cette semaine.', target: 25, rewardPoints: 450 },
      { key: 'weekly_campaigns_2', type: 'campaigns_created', title: 'صانع الحملات', description: 'أنشئ حملتين هذا الأسبوع.', titleEn: 'Campaign maker', titleFr: 'Créateur de campagnes', descriptionEn: 'Create 2 campaigns this week.', descriptionFr: 'Créez 2 campagnes cette semaine.', target: 2, rewardPoints: 160 },
      { key: 'weekly_referrals_2', type: 'referrals_count', title: 'سفير الأسبوع', description: 'ادعُ صديقين هذا الأسبوع.', titleEn: 'Ambassador of the week', titleFr: 'Ambassadeur de la semaine', descriptionEn: 'Invite 2 friends this week.', descriptionFr: 'Invitez 2 amis cette semaine.', target: 2, rewardPoints: 300 },
    ],
  },
  achievements: {
    items: [
      {
        key: 'tasks_10',
        metric: 'tasks_completed',
        titleEn: 'Task finisher',
        titleFr: 'Finisseur de tâches',
        descriptionEn: 'Complete 10 verified tasks.',
        descriptionFr: 'Terminez 10 tâches vérifiées.',
        title: 'منجز المهام',
        description: 'أكمل 10 مهام موثقة.',
        target: 10,
        rewardPoints: 200,
      },
      {
        key: 'campaigns_5',
        metric: 'campaigns_created',
        titleEn: 'Campaign manager',
        titleFr: 'Gestionnaire de campagnes',
        descriptionEn: 'Create 5 campaigns.',
        descriptionFr: 'Créez 5 campagnes.',
        title: 'مدير الحملات',
        description: 'أنشئ 5 حملات.',
        target: 5,
        rewardPoints: 250,
      },
      {
        key: 'purchase_1',
        metric: 'purchases_approved',
        titleEn: 'First purchase',
        titleFr: 'Premier achat',
        descriptionEn: 'Complete your first successful purchase.',
        descriptionFr: 'Effectuez votre premier achat réussi.',
        title: 'أول عملية شراء',
        description: 'أكمل أول عملية شراء ناجحة.',
        target: 1,
        rewardPoints: 300,
      },
      {
        key: 'referrals_3',
        metric: 'referrals_count',
        titleEn: 'App ambassador',
        titleFr: 'Ambassadeur de l\'appli',
        descriptionEn: 'Invite 3 friends.',
        descriptionFr: 'Invitez 3 amis.',
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
      { key: 'bronze', name: 'Bronze', minXp: 0, multiplier: 1, icon: '🥉', rewardPoints: 0 },
      { key: 'silver', name: 'Silver', minXp: 250, multiplier: 1.05, icon: '🥈', rewardPoints: 100 },
      { key: 'gold', name: 'Gold', minXp: 700, multiplier: 1.1, icon: '🥇', rewardPoints: 250 },
      { key: 'platinum', name: 'Platinum', minXp: 1400, multiplier: 1.15, icon: '💎', rewardPoints: 500 },
      { key: 'diamond', name: 'Diamond', minXp: 2600, multiplier: 1.2, icon: '🔷', rewardPoints: 900 },
      { key: 'master', name: 'Master', minXp: 4500, multiplier: 1.25, icon: '👑', rewardPoints: 1500 },
      { key: 'grandmaster', name: 'Grandmaster', minXp: 7500, multiplier: 1.3, icon: '🔥', rewardPoints: 2500 },
      { key: 'legend', name: 'Legend', minXp: 12000, multiplier: 1.4, icon: '🌟', rewardPoints: 5000 },
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
        key: 'baridimob',
        label: 'BaridiMob',
        enabled: false,
        type: 'manual',
        currency: 'DZD',
        instructions: 'افتح BaridiMob وحوّل المبلغ إلى الحساب الموضح أدناه، ثم أرسل رقم العملية وصورة الإثبات.',
        walletAddress: '',
        accountName: '',
        externalUrl: '',
        icon: '📲',
        logoKey: 'baridimob',
        minAmountCents: 0,
        maxAmountCents: 0,
        feePercent: 0,
        sortOrder: 0,
      },
      {
        key: 'binance_pay',
        label: 'Binance Pay',
        enabled: false,
        type: 'manual',
        currency: 'USD',
        instructions: 'أرسل المبلغ عبر Binance Pay إلى معرف الدفع أو العنوان الموضح أدناه، ثم أرسل رقم العملية وصورة الإثبات.',
        walletAddress: '',
        accountName: '',
        externalUrl: '',
        icon: '🟡',
        logoKey: 'binance_pay',
        minAmountCents: 0,
        maxAmountCents: 0,
        feePercent: 0,
        sortOrder: 1,
      },
      {
        key: 'redotpay',
        label: 'RedotPay',
        enabled: false,
        type: 'manual',
        currency: 'USD',
        instructions: 'حوّل المبلغ إلى عنوان RedotPay الموضح أدناه، ثم أرسل رقم العملية وصورة الإثبات.',
        walletAddress: '',
        accountName: '',
        externalUrl: '',
        icon: '🔴',
        logoKey: 'redotpay',
        minAmountCents: 0,
        maxAmountCents: 0,
        feePercent: 0,
        sortOrder: 2,
      },
      {
        key: 'paypal',
        label: 'PayPal',
        enabled: false,
        type: 'manual',
        currency: 'USD',
        instructions: 'أرسل المبلغ إلى حساب PayPal الموضح أدناه، ثم أرسل رقم العملية وصورة إثبات الدفع.',
        walletAddress: '',
        accountName: '',
        externalUrl: '',
        icon: '🔵',
        logoKey: 'paypal',
        minAmountCents: 0,
        maxAmountCents: 0,
        feePercent: 0,
        sortOrder: 3,
      },
      {
        key: 'usdt_trc20',
        label: 'USDT TRC20',
        enabled: false,
        type: 'manual',
        currency: 'USDT',
        instructions: 'أرسل USDT عبر شبكة TRC20 فقط إلى العنوان الموضح أدناه، ثم أرسل TxID وصورة الإثبات.',
        walletAddress: '',
        accountName: '',
        externalUrl: '',
        network: 'TRC20',
        icon: '₮',
        logoKey: 'usdt_trc20',
        minAmountCents: 0,
        maxAmountCents: 0,
        feePercent: 0,
        sortOrder: 4,
      },
      {
        key: 'manual_transfer',
        label: 'تحويل يدوي',
        enabled: true,
        type: 'manual',
        currency: 'USD',
        instructions: 'حوّل المبلغ ثم أرسل رقم العملية وصورة إثبات التحويل للمراجعة.',
        walletAddress: '',
        accountName: '',
        externalUrl: '',
        icon: '💳',
        logoKey: 'manual_transfer',
        minAmountCents: 0,
        maxAmountCents: 0,
        feePercent: 0,
        sortOrder: 99,
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
    reviewTitle: 'قيّم tikboost.wh ⭐',
    reviewBody: 'شاركنا تقييمك الجميل في المتجر واحصل على نقاط إضافية.',
    reviewSnoozeHours: 48,
  },
  vipPro: {
    enabled: true,
    monthlyPriceCents: 1000,
    currency: 'USD',
    bonusPerTask: 5,
    priorityBoost: true,
    plans: [
      { key: 'vip_starter', name: 'VIP Starter', priceCents: 199, durationDays: 7, bonusPerTask: 25, enabled: true, sortOrder: 0 },
      { key: 'vip_monthly', name: 'VIP', priceCents: 499, durationDays: 30, bonusPerTask: 50, enabled: true, sortOrder: 1 },
      { key: 'vip_pro', name: 'VIP PRO', priceCents: 999, durationDays: 30, bonusPerTask: 100, enabled: true, sortOrder: 2 },
      { key: 'vip_elite', name: 'Elite', priceCents: 1999, durationDays: 30, bonusPerTask: 200, enabled: true, sortOrder: 3 },
      { key: 'vip_ultimate', name: 'Ultimate', priceCents: 3999, durationDays: 90, bonusPerTask: 300, enabled: true, sortOrder: 4 },
    ],
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
  const text = normalizeString(value, fallback);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return fallback || '';
    return url.toString();
  } catch {
    return fallback || '';
  }
}

function normalizeWhatsapp(value, fallback = '') {
  const text = normalizeString(value, fallback);
  if (!text) return '';
  // WhatsApp Business "message" links (wa.me/message/XXXX) are not phone numbers: keep them whole.
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\/(message\/|send)/i.test(text)) return text;
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
  const tiktokUrl = normalizeUrl(app.tiktokUrl, DEFAULT_SETTINGS.app.tiktokUrl);
  const instagramUrl = normalizeUrl(app.instagramUrl, DEFAULT_SETTINGS.app.instagramUrl);
  const facebookUrl = normalizeUrl(app.facebookUrl, DEFAULT_SETTINGS.app.facebookUrl);
  const supportEmail = normalizeString(app.supportEmail, DEFAULT_SETTINGS.app.supportEmail);

  return normalizeContactLinks([
    { key: 'whatsapp', label: 'WhatsApp', value: whatsapp, enabled: whatsapp.length > 0 },
    { key: 'tiktok', label: 'TikTok', value: tiktokUrl, enabled: tiktokUrl.length > 0 },
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
  const defaultLogoByKey = { baridimob: 'baridimob', binance_pay: 'binance_pay', redotpay: 'redotpay', paypal: 'paypal', usdt_trc20: 'usdt_trc20', manual_transfer: 'manual_transfer' };
  const normalized = list
    .map((method, index) => ({
      key: normalizeString(method?.key, `method_${index + 1}`).toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      label: normalizeString(method?.label, normalizeString(method?.key, `Method ${index + 1}`)),
      enabled: normalizeBool(method?.enabled, true),
      type: ['manual', 'paypal'].includes(String(method?.type || '').toLowerCase()) ? String(method.type).toLowerCase() : 'manual',
      currency: normalizeString(method?.currency, 'USD').toUpperCase().slice(0, 10),
      instructions: normalizeString(method?.instructions, ''),
      walletAddress: normalizeString(method?.walletAddress, ''),
      accountName: normalizeString(method?.accountName, ''),
      externalUrl: normalizeString(method?.externalUrl, ''),
      network: normalizeString(method?.network, ''),
      icon: normalizeString(method?.icon, '💳'),
      logoKey: normalizeString(method?.logoKey, defaultLogoByKey[String(method?.key || '').toLowerCase()] || ''),
      minAmountCents: clampInt(method?.minAmountCents, 0, 1000000000, 0),
      maxAmountCents: clampInt(method?.maxAmountCents, 0, 1000000000, 0),
      feePercent: clampFloat(method?.feePercent, 0, 100, 0),
      sortOrder: clampInt(method?.sortOrder, 0, 100000, index),
    }))
    .filter((method) => method.key && method.label);

  const base = normalized.length ? normalized : DEFAULT_SETTINGS.payments.methods.slice();
  const existingKeys = new Set(base.map((item) => item.key));
  for (const recommended of DEFAULT_SETTINGS.payments.methods) {
    if (!existingKeys.has(recommended.key)) base.push({ ...recommended });
  }
  return base.sort((a, b) => a.sortOrder - b.sortOrder);
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
      rewardPoints: clampInt(item?.rewardPoints, 0, 100000000, 0),
      nameFr: normalizeString(item?.nameFr, ''),
      nameAr: normalizeString(item?.nameAr, ''),
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
      titleEn: normalizeString(item?.titleEn, ''),
      titleFr: normalizeString(item?.titleFr, ''),
      descriptionEn: normalizeString(item?.descriptionEn, ''),
      descriptionFr: normalizeString(item?.descriptionFr, ''),
      target: clampInt(item?.target, 1, 1000, 1),
      rewardPoints: clampInt(item?.rewardPoints, 0, 1000000, 0),
      url: normalizeString(item?.url, ''),
    }))
    .filter((item) => item.key);
}

function normalizeAchievementItems(items) {
  const list = Array.isArray(items) ? items : DEFAULT_SETTINGS.achievements.items;
  return list
    .map((item) => ({
      key: normalizeString(item?.key),
      metric: normalizeString(item?.metric || item?.type, 'tasks_completed'),
      title: normalizeString(item?.title, 'Achievement'),
      description: normalizeString(item?.description, ''),
      titleEn: normalizeString(item?.titleEn, ''),
      titleFr: normalizeString(item?.titleFr, ''),
      descriptionEn: normalizeString(item?.descriptionEn, ''),
      descriptionFr: normalizeString(item?.descriptionFr, ''),
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
  merged.app.tiktokUrl = normalizeUrl(merged.app.tiktokUrl, DEFAULT_SETTINGS.app.tiktokUrl);
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
  {
    const a = merged.app.announcement || {};
    merged.app.announcement = {
      enabled: normalizeBool(a.enabled, false),
      level: ['info', 'success', 'warning'].includes(String(a.level)) ? String(a.level) : 'info',
      text: normalizeString(a.text, ''),
      textEn: normalizeString(a.textEn, ''),
      textFr: normalizeString(a.textFr, ''),
      url: normalizeString(a.url, ''),
    };
    const m = merged.app.maintenance || {};
    merged.app.maintenance = {
      enabled: normalizeBool(m.enabled, false),
      message: normalizeString(m.message, ''),
      messageEn: normalizeString(m.messageEn, ''),
      messageFr: normalizeString(m.messageFr, ''),
    };
  }

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
  merged.ads.followMilestoneAdEnabled = normalizeBool(merged.ads.followMilestoneAdEnabled, DEFAULT_SETTINGS.ads.followMilestoneAdEnabled);
  merged.ads.followMilestoneCount = clampInt(merged.ads.followMilestoneCount, 1, 1000, DEFAULT_SETTINGS.ads.followMilestoneCount);
  merged.ads.followMilestoneAdType = ['INTERSTITIAL', 'REWARDED'].includes(String(merged.ads.followMilestoneAdType || '').toUpperCase()) ? String(merged.ads.followMilestoneAdType).toUpperCase() : 'INTERSTITIAL';
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
  merged.engagement = merged.engagement || {};
  merged.engagement.streakEnabled = normalizeBool(merged.engagement.streakEnabled, DEFAULT_SETTINGS.engagement.streakEnabled);
  merged.engagement.comebackEnabled = normalizeBool(merged.engagement.comebackEnabled, DEFAULT_SETTINGS.engagement.comebackEnabled);
  merged.engagement.comebackAfterDays = clampInt(merged.engagement.comebackAfterDays, 1, 30, DEFAULT_SETTINGS.engagement.comebackAfterDays);
  merged.engagement.comebackRewardPoints = clampInt(merged.engagement.comebackRewardPoints, 0, 1000000, DEFAULT_SETTINGS.engagement.comebackRewardPoints);
  merged.engagement.weeklyEnabled = normalizeBool(merged.engagement.weeklyEnabled, DEFAULT_SETTINGS.engagement.weeklyEnabled);
  merged.engagement.streakRewards = (Array.isArray(merged.engagement.streakRewards) ? merged.engagement.streakRewards : DEFAULT_SETTINGS.engagement.streakRewards).slice(0, 30).map(v => clampInt(v, 0, 1000000, 0));
  merged.engagement.weeklyChallenges = normalizeAchievementItems(merged.engagement.weeklyChallenges);
  merged.levels.xp.taskRewardXp = clampInt(merged.levels?.xp?.taskRewardXp, 0, 1000, DEFAULT_SETTINGS.levels.xp.taskRewardXp);
  merged.levels.xp.campaignCreateXp = clampInt(merged.levels?.xp?.campaignCreateXp, 0, 1000, DEFAULT_SETTINGS.levels.xp.campaignCreateXp);
  merged.levels.xp.purchaseXp = clampInt(merged.levels?.xp?.purchaseXp, 0, 1000, DEFAULT_SETTINGS.levels.xp.purchaseXp);
  merged.levels.xp.referralXp = clampInt(merged.levels?.xp?.referralXp, 0, 1000, DEFAULT_SETTINGS.levels.xp.referralXp);
  merged.levels.definitions = normalizeLevelDefinitions(merged.levels.definitions);

  merged.campaignPricing = normalizeCampaignPricing(merged.campaignPricing);
  merged.campaignRewards = normalizeCampaignRewards(merged.campaignRewards);
  merged.campaignRules = normalizeCampaignRules(merged.campaignRules);
  merged.payments.methods = normalizePaymentMethods(merged.payments?.methods);
  merged.vipPro = merged.vipPro || {};
  merged.vipPro.enabled = normalizeBool(merged.vipPro.enabled, DEFAULT_SETTINGS.vipPro.enabled);
  merged.vipPro.monthlyPriceCents = clampInt(merged.vipPro.monthlyPriceCents, 1, 100000000, DEFAULT_SETTINGS.vipPro.monthlyPriceCents);
  merged.vipPro.bonusPerTask = clampInt(merged.vipPro.bonusPerTask, 0, 100000, DEFAULT_SETTINGS.vipPro.bonusPerTask);
  merged.vipPro.priorityBoost = normalizeBool(merged.vipPro.priorityBoost, DEFAULT_SETTINGS.vipPro.priorityBoost);
  const plans = Array.isArray(merged.vipPro.plans) ? merged.vipPro.plans : DEFAULT_SETTINGS.vipPro.plans;
  const normalizedPlans = plans.map((item, i) => ({ key: normalizeString(item?.key, `vip_${i+1}`), productId: normalizeString(item?.productId, normalizeString(item?.key, `vip_${i+1}`)), name: normalizeString(item?.name, `VIP PRO ${item?.durationDays || 30} يوم`), priceCents: clampInt(item?.priceCents, 1, 100000000, 1000), durationDays: clampInt(item?.durationDays, 1, 3650, 30), bonusPerTask: clampInt(item?.bonusPerTask, 0, 100000, merged.vipPro.bonusPerTask), enabled: normalizeBool(item?.enabled, true), sortOrder: clampInt(item?.sortOrder, 0, 100000, i) }));
  // Keep existing admin custom plans, while automatically adding the tikboost.wh recommended tiers once.
  const existingKeys = new Set(normalizedPlans.map((p) => p.key));
  for (const recommended of DEFAULT_SETTINGS.vipPro.plans) {
    if (!existingKeys.has(recommended.key)) normalizedPlans.push({ ...recommended });
  }
  merged.vipPro.plans = normalizedPlans.slice(0, 50).sort((a,b)=>a.sortOrder-b.sortOrder);
  merged.notifications.enabled = normalizeBool(merged.notifications.enabled, DEFAULT_SETTINGS.notifications.enabled);
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
