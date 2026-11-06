const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const env = require('../config/env');

let io = null;
module.exports.getIO = () => io;

function parseOrigins(value) {
  if (value === '*') return true;
  return value.split(',').map((v) => v.trim());
}

function attachSockets(server) {
  io = new Server(server, {
    cors: {
      origin: parseOrigins(env.SOCKET_CORS_ORIGIN),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) return next();
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      socket.data.userId = payload.sub;
      socket.join(`user:${payload.sub}`);
      return next();
    } catch {
      return next(new Error('Unauthorized socket'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('identity', (userId) => {
      if (socket.data.userId && socket.data.userId === userId) {
        socket.join(`user:${userId}`);
      }
    });

    socket.on('campaign:join', (campaignId) => {
      if (typeof campaignId === 'string' && campaignId.length < 128) {
        socket.join(`campaign:${campaignId}`);
      }
    });
  });

  return io;
}

module.exports.attachSockets = attachSockets;
