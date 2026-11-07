import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken, TokenPayload } from '../shared/jwt.js';
import { config } from '../config/index.js';
import { logger } from '../shared/logger.js';

let io: Server | null = null;

interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: [config.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Authentication Middleware for Socket.IO
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      // Allow anonymous connection only for public room, but without user identity
      return next();
    }

    try {
      const payload = verifyAccessToken(token);
      socket.user = payload;
      next();
    } catch (err: any) {
      logger.warn(`Socket authentication failed for connection ${socket.id}: ${err.message}`);
      // Connection allowed in unauthenticated state
      next();
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user?.email || 'anonymous'})`);

    // Server-controlled rooms: Join private user room based ONLY on verified JWT payload
    if (socket.user?.userId) {
      const userRoom = `user:${socket.user.userId}`;
      socket.join(userRoom);
      logger.debug(`Socket ${socket.id} joined private room ${userRoom}`);

      // If user is administrator, join administrative room
      if (socket.user.role === 'admin') {
        socket.join('admin:operations');
        logger.debug(`Socket ${socket.id} joined admin room`);
      }
    }

    // Emit connection:ready with session state
    socket.emit('connection:ready', {
      connected: true,
      socketId: socket.id,
      authenticated: !!socket.user,
      userId: socket.user?.userId || null,
      timestamp: new Date().toISOString(),
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  logger.info('Socket.IO real-time engine initialized successfully');
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO server has not been initialized');
  }
  return io;
}

// Helper to safely emit to a specific user's private room
export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

// Helper to emit to admin operations room
export function emitAdminEvent(event: string, data: any) {
  if (!io) return;
  io.to('admin:operations').emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

// Broadcast system notification
export function broadcastEvent(event: string, data: any) {
  if (!io) return;
  io.emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}
