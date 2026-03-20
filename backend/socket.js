const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const notificationService = require('./services/notificationService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
let io;

function initSocket(httpServer) {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // Strict Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = { userId: payload.userId };
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // Connection Lifecycle and Room Mapping
  io.on('connection', async (socket) => {
    const userId = socket.user.userId;
    const roomName = `user_${userId}`;
    
    socket.join(roomName);
    console.log(`[socket] User ${userId} connected and joined room ${roomName} (socket: ${socket.id})`);

    // ── Persistent Notification Catch-up ────────────────────────────────────
    // Fetch and re-emit unread notifications for this user
    try {
      const unread = await notificationService.getUnreadNotifications(userId);
      if (unread.length > 0) {
        console.log(`[socket] Found ${unread.length} unread notifications for user ${userId}. Re-emitting...`);
        unread.forEach(notif => {
          emitToUser(userId, notif.type, notif.payload, notif.id);
        });
      }
    } catch (err) {
      console.error('[socket] Failed to fetch unread notifications:', err);
    }

    socket.on('disconnect', () => {
      console.log(`[socket] User ${userId} disconnected (socket: ${socket.id})`);
    });
  });

  return io;
}

const EVENT_SCHEMAS = {
  'order:new': ['orderId', 'buyerName', 'totalAmount', 'timestamp'],
  'order:update': ['orderId', 'status'],
  'order:cancelled': ['orderId', 'message'],
  'message:new': ['role', 'content', 'timestamp']
};

function emitToUser(userId, eventName, payload, notificationId = null) {
  if (!io) {
    console.warn('[socket] emitToUser called but io is not initialized');
    return;
  }
  
  // Strict Payload Validation Contract
  const expectedKeys = EVENT_SCHEMAS[eventName];
  if (expectedKeys) {
    const missing = expectedKeys.filter(k => payload[k] === undefined);
    if (missing.length > 0) {
      console.error(`[socket] Schema validation failed for '${eventName}'. Missing required keys: ${missing.join(', ')}`);
      return; 
    }
  }

  const roomName = `user_${userId}`;
  
  // Advanced Delivery Acknowledgement (ACK)
  io.to(roomName).timeout(5000).emit(eventName, payload, (err, responses) => {
    if (err) {
      console.warn(`[Socket] Delivery Timeout: ${eventName} → user_${userId} was dropped (No ACK).`);
    } else {
      console.log(`[Socket] ${eventName} → user_${userId} (ACK received)`);
      
      // If this was a persistent notification, mark it as read once ACKed
      if (notificationId) {
        notificationService.markAsRead(notificationId).catch(dbErr => {
          console.error(`[Socket] Failed to mark notification ${notificationId} as read:`, dbErr);
        });
      }
    }
  });
}

module.exports = { initSocket, emitToUser };
