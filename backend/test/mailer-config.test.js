const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('mailer: default provider is HTTPS (resend), not raw SMTP', async () => {
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.EMAIL_API_KEY = 're_test_dummykey_ABCDEFGHIJKLMNOPQRST';
  process.env.MAIL_FROM = 'TikBoost <onboarding@resend.dev>';

  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    delete require.cache[require.resolve('../src/config/env')];
    delete require.cache[require.resolve('../src/services/mailer.service')];
    const mailer = require('../src/services/mailer.service');
    await mailer.initMailer();
    assert.equal(mailer._internals.providerLabel, 'resend');
    assert.equal(mailer._internals.providerReady, true);
    assert.equal(typeof mailer.verifyEmailProvider, 'function');
    assert.equal(typeof mailer.sendPasswordResetCode, 'function');
  } finally {
    console.log = origLog;
  }

  for (const line of logs) {
    assert.ok(!line.includes('re_test_dummykey_ABCDEFGHIJKLMNOPQRST'), 'startup log leaked EMAIL_API_KEY');
  }
  assert.ok(logs.some((l) => l.includes('provider=resend')), 'startup log must state provider=resend');

  const src = fs.readFileSync(require.resolve('../src/services/mailer.service'), 'utf8');
  assert.ok(src.includes('https://api.resend.com/emails'), 'must POST to Resend HTTPS API');
  assert.ok(src.includes('https://api.brevo.com/v3/smtp/email'), 'must support Brevo HTTPS API');
  assert.ok(src.includes('api.mailgun.net'), 'must support Mailgun HTTPS API');
  assert.ok(!src.includes("require('nodemailer')"), 'mailer.service must not directly require nodemailer (kept in smtpTransport)');
});

test('mailer: gracefully reports not-ready when EMAIL_API_KEY is empty', async () => {
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.EMAIL_API_KEY = '';
  delete require.cache[require.resolve('../src/config/env')];
  delete require.cache[require.resolve('../src/services/mailer.service')];
  const mailer = require('../src/services/mailer.service');
  await mailer.initMailer();
  assert.equal(mailer._internals.providerReady, false);
  await assert.rejects(
    () => mailer.sendPasswordResetCode('who@example.com', '123456', 15),
    (err) => err.code === 'EMAIL_PROVIDER_NOT_READY',
  );
});
