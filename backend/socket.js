const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

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
    // JWT can be passed in auth object or headers
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
  io.on('connection', (socket) => {
    const userId = socket.user.userId;
    const roomName = `user_${userId}`;
    
    socket.join(roomName);
    console.log(`[socket] User ${userId} connected and joined room ${roomName} (socket: ${socket.id})`);

    socket.on('disconnect', () => {
      console.log(`[socket] User ${userId} disconnected (socket: ${socket.id})`);
    });
  });

  return io;
}

const EVENT_SCHEMAS = {
  'order:new': ['orderId', 'buyerName', 'totalAmount', 'timestamp'],
  'order:update': ['orderId', 'status'],
  'message:new': ['role', 'content', 'timestamp']
};

function emitToUser(userId, eventName, payload) {
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
      console.error(`[socket] Aborting emission to prevent malformed frontend state.`);
      return; 
    }
  }

  const roomName = `user_${userId}`;
  
  // Advanced Delivery Acknowledgement (ACK)
  io.to(roomName).timeout(5000).emit(eventName, payload, (err, responses) => {
    if (err) {
      console.warn(`[Socket] Delivery Timeout: ${eventName} → user_${userId} was dropped (No ACK).`);
      // In a strict Event Sourcing system, we would push this to a Dead Letter Queue 
      // or unread events table here. For now, we rely on the REST fallback.
    } else {
      console.log(`[Socket] ${eventName} → user_${userId} (ACK received)`);
    }
  });
}

module.exports = { initSocket, emitToUser };
