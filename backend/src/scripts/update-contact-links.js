/*
 * Writes the official WHSTO contact links into the database settings.
 * Needed once because links saved in the DB override the code defaults.
 *   node src/scripts/update-contact-links.js --dry-run
 *   node src/scripts/update-contact-links.js
 */
require('dotenv').config();
const prisma = require('../config/db');
const { DEFAULT_SETTINGS, getSettings, updateSettings } = require('../services/appSettings.service');

(async () => {
  const dry = process.argv.includes('--dry-run');
  const d = DEFAULT_SETTINGS.app;
  const current = await getSettings();
  // Keep the support e-mail the admin already configured; replace only the social/WhatsApp links.
  const email = current.app?.supportEmail || d.supportEmail;
  const patch = {
    app: {
      whatsapp: d.whatsapp,
      tiktokUrl: d.tiktokUrl,
      instagramUrl: d.instagramUrl,
      facebookUrl: d.facebookUrl,
      supportEmail: email,
      contactLinks: [
        { key: 'whatsapp', label: 'WhatsApp', value: d.whatsapp, enabled: true },
        { key: 'tiktok', label: 'TikTok', value: d.tiktokUrl, enabled: true },
        { key: 'instagram', label: 'Instagram', value: d.instagramUrl, enabled: true },
        { key: 'facebook', label: 'Facebook', value: d.facebookUrl, enabled: true },
        { key: 'email', label: 'Email', value: email, enabled: true },
      ],
    },
  };
  console.log('Before:', JSON.stringify(current.app?.contactLinks, null, 2));
  console.log('After :', JSON.stringify(patch.app.contactLinks, null, 2));
  if (dry) console.log('\n--dry-run: nothing written.');
  else { await updateSettings(patch); console.log('\nOfficial contact links saved.'); }
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch (_) {} process.exit(1); });
