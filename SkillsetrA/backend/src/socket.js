const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    socket.on('join_admin', () => {
      socket.join('admin');
    });

    socket.on('join_student', (studentId) => {
      if (studentId) {
        socket.join(`student_${studentId}`);
      }
    });

    socket.on('proctor_event', (data) => {
      io.to('admin').emit('proctor_event', data);
      io.emit('proctor_event', data);
    });

    socket.on('disconnect', () => {
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitToAdmin(event, data) {
  if (io) {
    try {
      io.to('admin').emit(event, data);
      io.emit(event, data);
    } catch (e) {
      console.error('[Socket.IO] emit error:', e);
    }
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToAdmin
};
