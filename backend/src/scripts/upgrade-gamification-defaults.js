/*
 * Brings an EXISTING database up to the v1.4 levels / missions defaults.
 *
 * Why this exists: settings saved in the database replace the built-in default
 * arrays, so deployments created before v1.4 keep their old 4 levels and old
 * daily tasks even after the code is updated. This script ADDS what is missing
 * (new levels, new tasks, level rewards, translations) and never deletes or
 * overwrites anything an admin has already customised.
 *
 *   node src/scripts/upgrade-gamification-defaults.js --dry-run   # preview
 *   node src/scripts/upgrade-gamification-defaults.js             # apply
 */
require('dotenv').config();
const prisma = require('../config/db');
const { DEFAULT_SETTINGS, getSettings, updateSettings } = require('../services/appSettings.service');

const TRANSLATION_FIELDS = ['titleEn', 'titleFr', 'descriptionEn', 'descriptionFr'];

function mergeByKey(current, defaults, fieldsToFill) {
  const cur = Array.isArray(current) ? current.map((x) => ({ ...x })) : [];
  const added = [];
  const filled = [];
  for (const def of defaults || []) {
    const hit = cur.find((x) => String(x.key) === String(def.key));
    if (!hit) {
      cur.push({ ...def });
      added.push(def.key);
      continue;
    }
    for (const field of fieldsToFill) {
      const empty = hit[field] === undefined || hit[field] === null || hit[field] === '';
      if (empty && def[field] !== undefined && def[field] !== '') {
        hit[field] = def[field];
        filled.push(`${def.key}.${field}`);
      }
    }
  }
  return { items: cur, added, filled };
}

(async () => {
  const dry = process.argv.includes('--dry-run');
  const current = await getSettings();

  const levels = mergeByKey(current.levels?.definitions, DEFAULT_SETTINGS.levels.definitions, ['rewardPoints', 'icon']);
  levels.items.sort((a, b) => Number(a.minXp) - Number(b.minXp));
  const daily = mergeByKey(current.dailyTasks?.items, DEFAULT_SETTINGS.dailyTasks.items, TRANSLATION_FIELDS);
  const weekly = mergeByKey(current.engagement?.weeklyChallenges, DEFAULT_SETTINGS.engagement.weeklyChallenges, TRANSLATION_FIELDS);
  const ach = mergeByKey(current.achievements?.items, DEFAULT_SETTINGS.achievements?.items || [], TRANSLATION_FIELDS);

  const report = {
    levelsAdded: levels.added, levelFieldsFilled: levels.filled,
    dailyTasksAdded: daily.added, dailyFieldsFilled: daily.filled.length,
    weeklyAdded: weekly.added, weeklyFieldsFilled: weekly.filled.length,
    achievementFieldsFilled: ach.filled.length,
  };
  console.log(JSON.stringify(report, null, 2));

  if (dry) {
    console.log('\n--dry-run: nothing was written.');
  } else {
    await updateSettings({
      levels: { definitions: levels.items },
      dailyTasks: { items: daily.items },
      engagement: { weeklyChallenges: weekly.items },
      ...(ach.items.length ? { achievements: { items: ach.items } } : {}),
    });
    console.log('\nUpgrade applied.');
  }
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error('Upgrade failed:', error);
  try { await prisma.$disconnect(); } catch (_) {}
  process.exit(1);
});
