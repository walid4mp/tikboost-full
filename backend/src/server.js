/* TikBoost Backend Entry */
require('dotenv').config();
const http = require('http');
const app = require('./app');
const { attachSockets } = require('./sockets/io');
const env = require('./config/env');

const server = http.createServer(app);
attachSockets(server);

server.listen(env.PORT, () => {
  console.log(`🚀 TikBoost API listening on :${env.PORT}  (${env.NODE_ENV})`);
});

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
