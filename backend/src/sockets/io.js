const { Server } = require('socket.io');
const env = require('../config/env');

let io = null;
module.exports.getIO = () => io;

function attachSockets(server) {
  io = new Server(server, {
    cors: {
      origin: env.SOCKET_CORS_ORIGIN === '*' ? true : env.SOCKET_CORS_ORIGIN.split(','),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    socket.on('identity', (userId) => {
      if (typeof userId === 'string' && userId.length < 64) {
        socket.join(`user:${userId}`);
      }
    });

    socket.on('campaign:join', (campaignId) => {
      if (typeof campaignId === 'string') socket.join(`campaign:${campaignId}`);
    });
  });

  return io;
}

module.exports.attachSockets = attachSockets;
