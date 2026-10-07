const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Fail fast: nothing about the poll is hard-coded, so refuse to start without config.
const required = ['POLL_QUESTION', 'POLL_OPTIONS', 'PORT', 'ADMIN_PASSWORD'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env var(s): ${missing.join(', ')}`);
  process.exit(1);
}

const { POLL_QUESTION, ADMIN_PASSWORD, APP_ENV = 'unknown' } = process.env;
const PORT = parseInt(process.env.PORT, 10);
const options = process.env.POLL_OPTIONS.split(',').map((s) => s.trim()).filter(Boolean);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}
if (options.length < 2) {
  console.error('POLL_OPTIONS must contain at least two comma-separated options');
  process.exit(1);
}

const votes = Object.fromEntries(options.map((o) => [o, 0]));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

// The page reads its question/options from here, so the HTML is environment-neutral.
app.get('/config', (_req, res) => {
  res.json({ question: POLL_QUESTION, options, env: APP_ENV });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: APP_ENV });
});

app.post('/admin/reset', (req, res) => {
  if (!req.body || req.body.password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'forbidden' });
  }
  options.forEach((o) => (votes[o] = 0));
  io.emit('votes', votes);
  res.json({ reset: true });
});

io.on('connection', (socket) => {
  socket.emit('votes', votes); // new visitors immediately see current totals
  socket.on('vote', (option) => {
    if (Object.prototype.hasOwnProperty.call(votes, option)) {
      votes[option] += 1;
      io.emit('votes', votes); // push to everyone, no refresh needed
    }
  });
});

server.listen(PORT, () => console.log(`[${APP_ENV}] Live Poll listening on port ${PORT}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
