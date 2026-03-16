const express = require('express');
const jwt = require('jsonwebtoken');
const { vectorizationStatusManager } = require('@librechat/api');

const router = express.Router();

/**
 * Verify JWT token from query parameter
 * @param {string} token - JWT token
 * @returns {Promise<object>} Decoded token payload
 */
const verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};

/**
 * SSE endpoint for real-time vectorization status updates
 * GET /api/files/vectorization/status/:fileId?token=xxx
 * Token is passed as query parameter because EventSource API doesn't support custom headers
 */
router.get('/status/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const { token } = req.query;

  // Verify JWT token from query parameter
  try {
    if (!token) {
      console.error('[vectorization SSE] ❌ No token provided for fileId:', fileId);
      return res.status(401).json({ message: 'Token required' });
    }
    
    const decoded = await verifyToken(token);
    // Auth successful - no logging for normal operation
  } catch (error) {
    console.error('[vectorization SSE] ❌ Auth failed for fileId:', fileId);
    console.error('[vectorization SSE] Error:', error.name, '-', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', error: error.message });
    }
    return res.status(401).json({ message: 'Unauthorized', error: error.message });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // CORS headers for local development
  const origin = req.headers.origin || 'http://localhost:3080';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Send initial connection confirmation
  res.write(': connected\n\n');
  
  // Send initial status greeting message
  try {
    const greetingPayload = JSON.stringify({
      event: 'connection',
      data: { message: 'SSE connection established', fileId, timestamp: Date.now() },
    });
    res.write(`data: ${greetingPayload}\n\n`);
  } catch (err) {
    console.error('[vectorization SSE] ❌ Failed to send greeting:', err.message);
  }

  // Register this response as a listener
  vectorizationStatusManager.addListener(fileId, res);
  
  // Send current status immediately if exists
  const currentStatus = vectorizationStatusManager.getStatus(fileId);
  if (currentStatus) {
    const payload = JSON.stringify({
      event: 'vectorization_status',
      data: currentStatus,
    });
    res.write(`data: ${payload}\n\n`);
  }

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeat);
      return;
    }
    res.write(': heartbeat\n\n');
  }, 30000); // Every 30 seconds

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    vectorizationStatusManager.removeListener(fileId, res);
    res.end();
  });
});

/**
 * Query endpoint for current vectorization status
 * GET /api/files/vectorization/status-query/:fileId
 */
router.get('/status-query/:fileId', (req, res) => {
  const { fileId } = req.params;
  const status = vectorizationStatusManager.getStatus(fileId);

  if (!status) {
    return res.status(404).json({
      error: 'Vectorization status not found',
      fileId,
    });
  }

  res.json(status);
});

/**
 * Get all active vectorization tasks
 * GET /api/files/vectorization/active
 */
router.get('/active', (req, res) => {
  const activeTasks = vectorizationStatusManager.getAllActive();
  res.json({
    count: activeTasks.length,
    tasks: activeTasks,
  });
});

module.exports = router;
