import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fileURLToPath from 'node:url';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'feedback.db');
const db = new DatabaseSync(DB_PATH);

// Initialize Tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL DEFAULT 'Tech Innovations Summit 2026',
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      sentiment TEXT NOT NULL,
      topic TEXT NOT NULL,
      is_mismatch INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

initDb();

export const ALLOWED_SENTIMENTS = ['positive', 'neutral', 'negative', 'Not analysed'];
export const ALLOWED_TOPICS = ['food', 'timing', 'content', 'venue', 'speakers', 'organization', 'other', 'Not analysed'];

export function addFeedback({ event_name = 'Tech Innovations Summit 2026', rating, comment, sentiment, topic, is_mismatch = 0 }) {
  const stmt = db.prepare(`
    INSERT INTO feedback (event_name, rating, comment, sentiment, topic, is_mismatch)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(event_name, Number(rating), comment, sentiment, topic, is_mismatch ? 1 : 0);
  
  const getStmt = db.prepare('SELECT * FROM feedback WHERE id = ?');
  return getStmt.get(result.lastInsertRowid);
}

export function getAllFeedback({ sentiment, topic, search, mismatch, limit = 100 } = {}) {
  let sql = 'SELECT * FROM feedback WHERE 1=1';
  const params = [];

  if (sentiment && sentiment !== 'all') {
    sql += ' AND sentiment = ?';
    params.push(sentiment);
  }

  if (topic && topic !== 'all') {
    sql += ' AND topic = ?';
    params.push(topic);
  }

  if (mismatch === 'true' || mismatch === true) {
    sql += ' AND is_mismatch = 1';
  }

  if (search) {
    sql += ' AND (comment LIKE ? OR event_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));

  return db.prepare(sql).all(...params);
}

export function getMetrics() {
  const total = db.prepare('SELECT COUNT(*) as count FROM feedback').get().count;
  const avgRatingRow = db.prepare('SELECT AVG(rating) as avgRating FROM feedback').get();
  const avgRating = avgRatingRow && avgRatingRow.avgRating ? Number(avgRatingRow.avgRating).toFixed(1) : '0.0';
  
  const mismatchCount = db.prepare('SELECT COUNT(*) as count FROM feedback WHERE is_mismatch = 1').get().count;
  const notAnalyzedCount = db.prepare('SELECT COUNT(*) as count FROM feedback WHERE sentiment = ? OR sentiment = ?')
    .get('Not analysed', 'not_analyzed').count;

  // Sentiment Breakdown
  const sentimentRows = db.prepare(`
    SELECT sentiment, COUNT(*) as count 
    FROM feedback 
    GROUP BY sentiment
  `).all();
  
  const sentimentCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
    'Not analysed': 0
  };

  sentimentRows.forEach(row => {
    const key = row.sentiment === 'not_analyzed' ? 'Not analysed' : row.sentiment;
    if (sentimentCounts.hasOwnProperty(key)) {
      sentimentCounts[key] = row.count;
    } else {
      sentimentCounts[key] = row.count;
    }
  });

  // Topic Breakdown
  const topicRows = db.prepare(`
    SELECT topic, COUNT(*) as count 
    FROM feedback 
    GROUP BY topic
  `).all();

  const topicCounts = {};
  ALLOWED_TOPICS.forEach(t => { topicCounts[t] = 0; });
  topicRows.forEach(row => {
    topicCounts[row.topic] = row.count;
  });

  // Rating Distribution
  const ratingRows = db.prepare(`
    SELECT rating, COUNT(*) as count 
    FROM feedback 
    GROUP BY rating
  `).all();
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingRows.forEach(row => {
    ratingCounts[row.rating] = row.count;
  });

  return {
    total,
    avgRating,
    mismatchCount,
    notAnalyzedCount,
    sentimentCounts,
    topicCounts,
    ratingCounts
  };
}

export function getRecentFeedbackForSummary(limit = 20) {
  return db.prepare('SELECT id, rating, comment, sentiment, topic FROM feedback ORDER BY created_at DESC LIMIT ?').all(Number(limit));
}

export function updateFeedbackAnalysis(id, { sentiment, topic, is_mismatch }) {
  const stmt = db.prepare(`
    UPDATE feedback 
    SET sentiment = ?, topic = ?, is_mismatch = ?
    WHERE id = ?
  `);
  stmt.run(sentiment, topic, is_mismatch ? 1 : 0, Number(id));
  return db.prepare('SELECT * FROM feedback WHERE id = ?').get(Number(id));
}

export function seedSampleData() {
  // Check if data already exists
  const existing = db.prepare('SELECT COUNT(*) as count FROM feedback').get().count;
  if (existing > 0) {
    return { seeded: false, message: 'Database already has feedback entries.' };
  }

  const sampleEntries = [
    { rating: 5, comment: "The keynote on AI trends was absolutely mind-blowing! Extremely well prepared.", sentiment: "positive", topic: "speakers", is_mismatch: 0 },
    { rating: 5, comment: "Loved the networking lunch! Catering provided amazing vegan options and fresh espresso.", sentiment: "positive", topic: "food", is_mismatch: 0 },
    { rating: 1, comment: "The venue AC was broken, room was boiling hot, and audio kept cutting out every 5 minutes.", sentiment: "negative", topic: "venue", is_mismatch: 0 },
    { rating: 2, comment: "Sessions started 45 minutes late and cut off the final Q&A panel completely.", sentiment: "negative", topic: "timing", is_mismatch: 0 },
    { rating: 5, comment: "Horrible organization, terrible speakers, cold coffee and total waste of time!", sentiment: "negative", topic: "organization", is_mismatch: 1 }, // Intentional mismatch (5 stars + negative)
    { rating: 1, comment: "Best conference of the year! Incredible insights and awesome swag bags!", sentiment: "positive", topic: "content", is_mismatch: 1 }, // Intentional mismatch (1 star + positive)
    { rating: 4, comment: "Great content overall, though the workshop room was a bit cramped for 100 people.", sentiment: "positive", topic: "content", is_mismatch: 0 },
    { rating: 3, comment: "Average presentation. Slides were standard, nothing new compared to last year.", sentiment: "neutral", topic: "content", is_mismatch: 0 },
    { rating: 5, comment: "Super smooth check-in process at registration desk. Volunteers were super friendly!", sentiment: "positive", topic: "organization", is_mismatch: 0 },
    { rating: 2, comment: "Lunch queue was over 40 minutes long and ran out of main dishes early.", sentiment: "negative", topic: "food", is_mismatch: 0 },
    { rating: 4, comment: "Timings were mostly respected, nice break intervals between sessions.", sentiment: "positive", topic: "timing", is_mismatch: 0 },
    { rating: 3, comment: "The Wi-Fi was spotty in hall B, but the coffee station was decent.", sentiment: "neutral", topic: "venue", is_mismatch: 0 },
    { rating: 5, comment: "Outstanding workshop on machine learning models! Hands-on code was super clear.", sentiment: "positive", topic: "speakers", is_mismatch: 0 },
    { rating: 1, comment: "No parking spaces left and security guard was unhelpful when asking for directions.", sentiment: "negative", topic: "organization", is_mismatch: 0 },
    { rating: 4, comment: "Very engaging panel discussion on future tech trends. Recommended!", sentiment: "positive", topic: "speakers", is_mismatch: 0 }
  ];

  const stmt = db.prepare(`
    INSERT INTO feedback (event_name, rating, comment, sentiment, topic, is_mismatch)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  sampleEntries.forEach(entry => {
    stmt.run('Tech Innovations Summit 2026', entry.rating, entry.comment, entry.sentiment, entry.topic, entry.is_mismatch);
  });

  return { seeded: true, count: sampleEntries.length };
}

export function clearAllFeedback() {
  db.exec('DELETE FROM feedback;');
  return { success: true };
}
