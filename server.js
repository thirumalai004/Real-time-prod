const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

// ---------------------------------------------------------------
// 1. CONFIG: every setting comes from environment variables
// ---------------------------------------------------------------
function loadConfig(env = process.env) {
  // ADMIN_TOKEN is a secret: no default, the app refuses to start without it
  if (!env.ADMIN_TOKEN) {
    throw new Error('ADMIN_TOKEN is required (pass it with: docker run -e ADMIN_TOKEN=...)');
  }

  const options = [...new Set(
    (env.POLL_OPTIONS || 'Node.js,Python,Go').split(',').map((s) => s.trim()).filter(Boolean)
  )];
  if (options.length < 2) {
    throw new Error('POLL_OPTIONS needs at least 2 comma-separated choices');
  }

  const logLevel = env.LOG_LEVEL || 'info';
  if (!['debug', 'info'].includes(logLevel)) {
    throw new Error('LOG_LEVEL must be "debug" or "info"');
  }

  return {
    port: Number(env.PORT) || 3000,
    appEnv: env.APP_ENV || 'dev',
    question: env.POLL_QUESTION || 'Which language do you prefer?',
    options,
    logLevel,
    buildNumber: env.BUILD_NUMBER || 'local',
    adminToken: env.ADMIN_TOKEN,
  };
}

// Only the non-secret settings are allowed to leave the server
const publicConfig = (cfg) => ({
  appEnv: cfg.appEnv,
  question: cfg.question,
  options: cfg.options,
});

const sameToken = (a, b) => {
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(a), h(b));
};

// ---------------------------------------------------------------
// 2. APP: real-time voting with Socket.IO
// ---------------------------------------------------------------
function createApp(cfg) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const log = {
    info: (...a) => console.log('[info]', ...a),
    debug: (...a) => { if (cfg.logLevel === 'debug') console.log('[debug]', ...a); },
  };

  const counts = Object.fromEntries(cfg.options.map((o) => [o, 0]));
  const snapshot = () => ({
    counts: { ...counts },
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    viewers: io.engine.clientsCount,
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/config', (req, res) => res.json(publicConfig(cfg)));
  app.get('/version', (req, res) => res.json({ build: cfg.buildNumber, env: cfg.appEnv }));
  app.get('/api/results', (req, res) => res.json(snapshot()));

  app.post('/reset', (req, res) => {
    if (!sameToken(req.get('x-admin-token') || '', cfg.adminToken)) {
      log.info('reset rejected: bad token');
      return res.status(401).json({ error: 'unauthorized' });
    }
    cfg.options.forEach((o) => { counts[o] = 0; });
    for (const s of io.sockets.sockets.values()) delete s.data.vote;
    io.emit('reset');
    io.emit('results', snapshot());
    log.info('votes reset by admin');
    res.json({ status: 'reset' });
  });

  io.on('connection', (socket) => {
    log.debug('client connected', socket.id);
    socket.emit('results', snapshot());
    io.emit('results', snapshot());

    socket.on('vote', (option) => {
      if (!cfg.options.includes(option)) return;       // ignore unknown options
      const previous = socket.data.vote;
      if (previous === option) return;
      if (previous) counts[previous] -= 1;              // switching vote
      counts[option] += 1;
      socket.data.vote = option;
      log.debug('vote', socket.id, option);
      io.emit('results', snapshot());
    });

    socket.on('disconnect', () => {
      log.debug('client disconnected', socket.id);
      setImmediate(() => io.emit('results', snapshot()));
    });
  });

  return { app, server, io };
}

// ---------------------------------------------------------------
// 3. START: fail fast with a clear message if config is wrong
// ---------------------------------------------------------------
if (require.main === module) {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (err) {
    console.error(`Config error: ${err.message}`);
    process.exit(1);
  }
  const { server } = createApp(cfg);
  server.listen(cfg.port, () => {
    // never print the token
    console.log(`Live Poll [${cfg.appEnv}] build=${cfg.buildNumber} port=${cfg.port} log=${cfg.logLevel}`);
    console.log(`Question: ${cfg.question} | Options: ${cfg.options.join(', ')}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { loadConfig, publicConfig, createApp };
