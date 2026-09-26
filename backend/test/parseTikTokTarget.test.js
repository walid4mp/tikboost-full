const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseTikTokTarget,
  sanitizeTikTokUrl,
  extractTikTokMetadata,
} = require('../src/utils/helpers');

test('sanitizes account URL and strips query parameters', async () => {
  const parsed = await parseTikTokTarget('https://www.tiktok.com/@User.Name?_r=1&_t=abc');
  assert.equal(parsed.valid, true);
  assert.equal(parsed.targetUsername, '@user.name');
  assert.equal(parsed.videoId, null);
  assert.equal(parsed.targetUrl, 'https://www.tiktok.com/@User.Name');
});

test('extracts username and videoId from canonical video URL', async () => {
  const parsed = await parseTikTokTarget('https://www.tiktok.com/@Example/video/1234567890?is_from_webapp=1');
  assert.equal(parsed.valid, true);
  assert.equal(parsed.targetUsername, '@example');
  assert.equal(parsed.videoId, '1234567890');
  assert.equal(parsed.targetUrl, 'https://www.tiktok.com/@Example/video/1234567890');
});

test('supports m.tiktok.com profile links', async () => {
  const parsed = await parseTikTokTarget('https://m.tiktok.com/@Mobile.Creator/?share_app_id=123');
  assert.equal(parsed.valid, true);
  assert.equal(parsed.targetUsername, '@mobile.creator');
  assert.equal(parsed.videoId, null);
  assert.equal(parsed.targetUrl, 'https://m.tiktok.com/@Mobile.Creator');
});

test('resolves vt short links before parsing', async () => {
  const parsed = await parseTikTokTarget('https://vt.tiktok.com/ZS4kjkBvV/?_r=1', {
    resolveFinalUrl: async () => 'https://www.tiktok.com/@Creator/video/9876543210?is_from_webapp=1&_t=foo',
  });
  assert.equal(parsed.valid, true);
  assert.equal(parsed.isShortLink, true);
  assert.equal(parsed.targetUsername, '@creator');
  assert.equal(parsed.videoId, '9876543210');
  assert.equal(parsed.targetUrl, 'https://www.tiktok.com/@Creator/video/9876543210');
});

test('resolves vm short links before parsing', async () => {
  const parsed = await parseTikTokTarget('https://vm.tiktok.com/XXXXXXXX/', {
    resolveFinalUrl: async () => 'https://www.tiktok.com/@AnotherUser/',
  });
  assert.equal(parsed.valid, true);
  assert.equal(parsed.targetUsername, '@anotheruser');
  assert.equal(parsed.videoId, null);
  assert.equal(parsed.targetUrl, 'https://www.tiktok.com/@AnotherUser');
});

test('resolves official /t/ short links before parsing', async () => {
  const parsed = await parseTikTokTarget('https://www.tiktok.com/t/ZXCVBN123/?_t=1', {
    resolveFinalUrl: async () => 'https://www.tiktok.com/@FinalUser/video/111222333444',
  });
  assert.equal(parsed.valid, true);
  assert.equal(parsed.targetUsername, '@finaluser');
  assert.equal(parsed.videoId, '111222333444');
  assert.equal(parsed.targetUrl, 'https://www.tiktok.com/@FinalUser/video/111222333444');
});

test('rejects unsupported hosts', async () => {
  const parsed = await parseTikTokTarget('https://example.com/@user/video/1');
  assert.equal(parsed.valid, false);
  assert.equal(parsed.reason, 'host');
});

test('rejects non-profile/non-video TikTok paths', async () => {
  const parsed = await parseTikTokTarget('https://www.tiktok.com/discover/cats');
  assert.equal(parsed.valid, false);
  assert.equal(parsed.reason, 'path');
});

test('helper functions remain deterministic', () => {
  assert.equal(
    sanitizeTikTokUrl('https://tiktok.com/@User/video/42/?_r=1#frag'),
    'https://www.tiktok.com/@User/video/42',
  );
  assert.deepEqual(extractTikTokMetadata(new URL('https://www.tiktok.com/@User/video/42')), {
    targetUsername: '@user',
    videoId: '42',
  });
});
