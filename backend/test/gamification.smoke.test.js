const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('crypto');

let server;
let baseUrl;
let token;

async function api(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { response, body };
}

async function signupUser(prefix) {
  const email = `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;
  const payload = {
    email,
    password: 'Passw0rd!123',
    name: prefix,
  };
  const { response, body } = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 201, JSON.stringify(body));
  return body;
}

test.before(async () => {
  const app = require('../src/app');
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const user = await signupUser('gamer');
  token = user.accessToken;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('smoke-test rewards, wheel and public config APIs', async () => {
  const auth = { authorization: `Bearer ${token}` };

  const status = await api('/api/rewards/status', { headers: auth });
  assert.equal(status.response.status, 200, JSON.stringify(status.body));
  assert.ok(status.body.rewards);
  assert.ok(status.body.level);

  const profile = await api('/api/rewards/profile', { headers: auth });
  assert.equal(profile.response.status, 200, JSON.stringify(profile.body));

  const prizes = await api('/api/wheel/prizes', { headers: auth });
  assert.equal(prizes.response.status, 200, JSON.stringify(prizes.body));
  assert.ok(Array.isArray(prizes.body.prizes));

  const loginClaim = await api('/api/rewards/login/claim', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({}),
  });
  assert.equal(loginClaim.response.status, 200, JSON.stringify(loginClaim.body));

  const chest = await api('/api/rewards/chest', { headers: auth });
  assert.equal(chest.response.status, 200, JSON.stringify(chest.body));

  const dailyTasks = await api('/api/rewards/daily-tasks', { headers: auth });
  assert.equal(dailyTasks.response.status, 200, JSON.stringify(dailyTasks.body));
  assert.ok(Array.isArray(dailyTasks.body.items));

  const completeManual = await api('/api/rewards/daily-tasks/share_app/complete', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({}),
  });
  assert.equal(completeManual.response.status, 200, JSON.stringify(completeManual.body));

  const achievements = await api('/api/rewards/achievements', { headers: auth });
  assert.equal(achievements.response.status, 200, JSON.stringify(achievements.body));
  assert.ok(Array.isArray(achievements.body.items));

  const clientConfig = await api('/api/config/client');
  assert.equal(clientConfig.response.status, 200, JSON.stringify(clientConfig.body));
  assert.ok(clientConfig.body.config);
  assert.ok(clientConfig.body.config.rewards);
  assert.ok(clientConfig.body.config.wheel);
  assert.equal(clientConfig.body.config.app.supportEmail, 'ww608352@gmail.com');
  assert.equal(clientConfig.body.config.app.whatsapp, '213779109990');
  assert.equal(clientConfig.body.config.app.instagramUrl, 'https://www.instagram.com/wh.s.8');
  assert.equal(clientConfig.body.config.app.facebookUrl, 'https://www.facebook.com/profile.php?id=61570663858487');
  assert.deepEqual(
    clientConfig.body.config.app.contactLinks.map((item) => item.key),
    ['whatsapp', 'instagram', 'facebook', 'email'],
  );
});
