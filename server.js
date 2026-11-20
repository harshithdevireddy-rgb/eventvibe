import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  addFeedback, 
  getAllFeedback, 
  getMetrics, 
  getRecentFeedbackForSummary, 
  updateFeedbackAnalysis,
  seedSampleData, 
  clearAllFeedback 
} from './db.js';
import { analyzeFeedback, generateExecutiveSummary, detectRatingMismatch } from './aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper to parse JSON body from HTTP Request
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload size limit exceeded'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON input'));
      }
    });
    req.on('error', reject);
  });
}

// Helper for JSON HTTP Response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// HTTP Request Handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // API ROUTES
    if (pathname === '/api/feedback' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { rating, comment, event_name, customApiKey } = body;

      // Validation
      if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
        return sendJson(res, 400, { error: 'Rating must be an integer between 1 and 5' });
      }

      if (!comment || typeof comment !== 'string' || !comment.trim()) {
        return sendJson(res, 400, { error: 'Comment cannot be empty' });
      }

      if (comment.length > 2000) {
        return sendJson(res, 400, { error: 'Comment must be under 2000 characters' });
      }

      // Step 1: Backend invokes AI Service (Gracefully degraded if unavailable)
      const aiResult = await analyzeFeedback({ 
        rating: Number(rating), 
        comment: comment.trim(),
        customApiKey
      });

      // Step 2: Save to Database
      const savedEntry = addFeedback({
        event_name: event_name || 'Tech Innovations Summit 2026',
        rating: Number(rating),
        comment: comment.trim(),
        sentiment: aiResult.sentiment,
        topic: aiResult.topic,
        is_mismatch: aiResult.is_mismatch
      });

      return sendJson(res, 201, {
        message: 'Feedback submitted successfully',
        feedback: savedEntry,
        ai_status: aiResult.ai_status,
        ai_reason: aiResult.reason || null
      });
    }

    if (pathname === '/api/feedback' && method === 'GET') {
      const sentiment = parsedUrl.searchParams.get('sentiment') || 'all';
      const topic = parsedUrl.searchParams.get('topic') || 'all';
      const search = parsedUrl.searchParams.get('search') || '';
      const mismatch = parsedUrl.searchParams.get('mismatch') || 'false';
      const limit = parsedUrl.searchParams.get('limit') || 100;

      const items = getAllFeedback({ sentiment, topic, search, mismatch, limit });
      const metrics = getMetrics();

      return sendJson(res, 200, {
        items,
        metrics
      });
    }

    if (pathname === '/api/feedback/summary' && method === 'POST') {
      const body = await parseJsonBody(req);
      const limit = body.limit || 20;
      const customApiKey = body.customApiKey || null;

      const recentItems = getRecentFeedbackForSummary(limit);
      const summaryData = await generateExecutiveSummary(recentItems, customApiKey);

      return sendJson(res, 200, {
        executive_summary: summaryData,
        comments_analyzed_count: recentItems.length
      });
    }

    if (pathname === '/api/feedback/reanalyze' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { id, customApiKey } = body;

      if (!id) {
        return sendJson(res, 400, { error: 'Feedback ID is required' });
      }

      const all = getAllFeedback({ limit: 1000 });
      const target = all.find(f => f.id === Number(id));

      if (!target) {
        return sendJson(res, 404, { error: 'Feedback entry not found' });
      }

      const aiResult = await analyzeFeedback({
        rating: target.rating,
        comment: target.comment,
        customApiKey
      });

      const updated = updateFeedbackAnalysis(id, {
        sentiment: aiResult.sentiment,
        topic: aiResult.topic,
        is_mismatch: aiResult.is_mismatch
      });

      return sendJson(res, 200, {
        message: 'Feedback re-analyzed successfully',
        feedback: updated,
        ai_status: aiResult.ai_status
      });
    }

    if (pathname === '/api/feedback/export' && method === 'GET') {
      const items = getAllFeedback({ limit: 5000 });
      
      let csvContent = 'ID,Event Name,Rating,Sentiment,Topic,Mismatch Alert,Comment,Submitted At\n';
      
      items.forEach(item => {
        const cleanComment = `"${(item.comment || '').replace(/"/g, '""')}"`;
        const cleanEvent = `"${(item.event_name || '').replace(/"/g, '""')}"`;
        const mismatchLabel = item.is_mismatch ? 'YES' : 'NO';
        csvContent += `${item.id},${cleanEvent},${item.rating},${item.sentiment},${item.topic},${mismatchLabel},${cleanComment},${item.created_at}\n`;
      });

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="feedback_export.csv"',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(csvContent);
    }

    if (pathname === '/api/seed' && method === 'POST') {
      const result = seedSampleData();
      const metrics = getMetrics();
      return sendJson(res, 200, { ...result, metrics });
    }

    if (pathname === '/api/clear' && method === 'POST') {
      const result = clearAllFeedback();
      const metrics = getMetrics();
      return sendJson(res, 200, { ...result, metrics });
    }

    if (pathname === '/api/health' && method === 'GET') {
      const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);
      return sendJson(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        ai_key_configured: hasApiKey,
        database: 'connected (SQLite)'
      });
    }

    // STATIC FILE SERVING
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    
    // Security check to prevent path traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('403 Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA routes if needed
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }

      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('500 Internal Server Error');
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

  } catch (error) {
    console.error('[Server Request Error]', error);
    sendJson(res, 500, { error: 'Internal Server Error', message: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AI Event Feedback Collector Server Running!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔑 AI API Key Status: ${process.env.GEMINI_API_KEY ? 'Configured ✅' : 'Missing ⚠️ (Will use graceful degradation)'}`);
  console.log(`=======================================================`);
});
