function attachSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 socket connected: ${socket.id}`);

    socket.on('room:subscribe', (roomId) => {
      socket.join(`room:${roomId}`);
    });

    socket.on('room:unsubscribe', (roomId) => {
      socket.leave(`room:${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { attachSocketHandlers };
