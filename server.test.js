const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { io: connect } = require('socket.io-client');
const { loadConfig, createApp } = require('../server');

const SECRET = 'unit-test-secret';
const env = { ADMIN_TOKEN: SECRET, APP_ENV: 'test', POLL_QUESTION: 'Tea or coffee?', POLL_OPTIONS: 'Tea, Coffee ,Water' };

let server, url;

before(async () => {
  ({ server } = createApp(loadConfig(env)));
  await new Promise((r) => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const client = () => connect(url, { transports: ['websocket'] });
const waitFor = (socket, event, pred = () => true) => new Promise((resolve) => {
  const handler = (data) => { if (pred(data)) { socket.off(event, handler); resolve(data); } };
  socket.on(event, handler);
});

// ---------- config tests (the "environment variable" part) ----------
test('app refuses to start without ADMIN_TOKEN', () => {
  assert.throws(() => loadConfig({}), /ADMIN_TOKEN is required/);
});

test('POLL_OPTIONS needs at least 2 choices', () => {
  assert.throws(() => loadConfig({ ADMIN_TOKEN: 'x', POLL_OPTIONS: 'OnlyOne' }), /at least 2/);
});

test('LOG_LEVEL must be valid', () => {
  assert.throws(() => loadConfig({ ADMIN_TOKEN: 'x', LOG_LEVEL: 'loud' }), /LOG_LEVEL/);
});

test('environment variables are read and trimmed; defaults apply', () => {
  const cfg = loadConfig(env);
  assert.deepStrictEqual(cfg.options, ['Tea', 'Coffee', 'Water']);
  assert.strictEqual(cfg.appEnv, 'test');
  const defaults = loadConfig({ ADMIN_TOKEN: 'x' });
  assert.strictEqual(defaults.port, 3000);
  assert.strictEqual(defaults.appEnv, 'dev');
});

// ---------- HTTP tests ----------
test('GET /health returns 200', async () => {
  assert.strictEqual((await fetch(`${url}/health`)).status, 200);
});

test('GET /config shows public settings and never the secret', async () => {
  const res = await fetch(`${url}/config`);
  const text = await res.text();
  const body = JSON.parse(text);
  assert.strictEqual(body.appEnv, 'test');
  assert.strictEqual(body.question, 'Tea or coffee?');
  assert.ok(!text.includes(SECRET), 'secret leaked in /config');
});

// ---------- real-time tests ----------
test('a vote is pushed to every connected client instantly', async () => {
  const a = client(), b = client();
  await Promise.all([waitFor(a, 'results'), waitFor(b, 'results')]);
  const seen = waitFor(b, 'results', (r) => r.counts.Tea === 1);
  a.emit('vote', 'Tea');
  const r = await seen;
  assert.strictEqual(r.counts.Tea, 1);
  a.close(); b.close();
});

test('switching a vote moves it; unknown options are ignored', async () => {
  const a = client();
  await waitFor(a, 'results');
  a.emit('vote', 'Coffee');
  await waitFor(a, 'results', (r) => r.counts.Coffee >= 1);
  a.emit('vote', 'Nonsense');
  a.emit('vote', 'Water');
  const r = await waitFor(a, 'results', (x) => x.counts.Water >= 1);
  assert.ok(!('Nonsense' in r.counts));
  assert.strictEqual(r.counts.Coffee, 0);
  a.close();
});

// ---------- admin / secret tests ----------
test('POST /reset needs the correct ADMIN_TOKEN', async () => {
  assert.strictEqual((await fetch(`${url}/reset`, { method: 'POST' })).status, 401);
  const wrong = await fetch(`${url}/reset`, { method: 'POST', headers: { 'x-admin-token': 'wrong' } });
  assert.strictEqual(wrong.status, 401);

  const ok = await fetch(`${url}/reset`, { method: 'POST', headers: { 'x-admin-token': SECRET } });
  assert.strictEqual(ok.status, 200);
  const results = await (await fetch(`${url}/api/results`)).json();
  assert.strictEqual(results.total, 0);
});
