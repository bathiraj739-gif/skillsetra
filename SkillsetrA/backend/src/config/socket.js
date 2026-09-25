import { Server } from 'socket.io'

let io = null

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`)

    socket.on('join_admin', () => {
      socket.join('admin_room')
      console.log(`📡 Socket ${socket.id} joined admin_room`)
    })

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`)
    })
  })

  return io
}

export function getIO() {
  return io
}

export function notifyAdmin(eventName, data) {
  if (io) {
    io.to('admin_room').emit(eventName, data)
    io.emit(eventName, data) // Also broadcast for listening dashboards
  }
}
