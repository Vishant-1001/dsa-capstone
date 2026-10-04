const createApp = require('./app');
const { bootstrap, persistClock } = require('./bootstrap');
const simulation = require('./services/simulation');

const PORT = Number(process.env.PORT) || 4000;
const TICK_MS = 250;

try {
  bootstrap();
} catch (err) {
  console.error('Could not start: the database failed to initialise.', err);
  process.exit(1);
}

const app = createApp();
const server = app.listen(PORT, () => {
  console.log(`RapidResQ server listening on http://localhost:${PORT}`);
});
server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Set PORT to another value.` : err);
  process.exit(1);
});

let last = Date.now();
const timer = setInterval(() => {
  const nowMs = Date.now();
  const dt = (nowMs - last) / 1000;
  last = nowMs;
  try {
    simulation.tick(dt);
  } catch (err) {
    console.error('[simulation] tick failed:', err);
  }
}, TICK_MS);

function shutdown() {
  clearInterval(timer);
  try {
    persistClock();
  } catch (err) {
    // nothing more to do while exiting
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// A bug in one request must not take the whole control room down.
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
