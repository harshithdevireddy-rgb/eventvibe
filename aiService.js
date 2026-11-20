import { ALLOWED_SENTIMENTS, ALLOWED_TOPICS } from './db.js';

const VALID_SENTIMENTS = ['positive', 'neutral', 'negative'];
const VALID_TOPICS = ['food', 'timing', 'content', 'venue', 'speakers', 'organization', 'other'];

/**
 * Clean raw text from AI model output to extract JSON
 */
function extractJsonFromText(text) {
  if (!text) return null;
  
  // Remove markdown code fence blocks if present (```json ... ```)
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Try regex extraction for json object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Check if rating and sentiment conflict
 */
export function detectRatingMismatch(rating, sentiment) {
  const numRating = Number(rating);
  const normSentiment = String(sentiment).toLowerCase();

  if ((numRating >= 4 && normSentiment === 'negative') ||
      (numRating <= 2 && normSentiment === 'positive')) {
    return true;
  }
  return false;
}

/**
 * Analyze a single feedback entry with Gemini API
 */
export async function analyzeFeedback({ rating, comment, customApiKey = null }) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY not found in environment. Falling back to "Not analysed".');
    return {
      sentiment: 'Not analysed',
      topic: 'Not analysed',
      is_mismatch: false,
      ai_status: 'unavailable',
      reason: 'No GEMINI_API_KEY provided in backend environment.'
    };
  }

  const promptText = `
You are an event feedback classifier. Analyze the following attendee comment for an event:

Rating Given: ${rating} out of 5 stars
Attendee Comment: "${comment}"

Requirements:
1. "sentiment" MUST be strictly one of: "positive", "neutral", "negative".
2. "topic" MUST be strictly one of: "food", "timing", "content", "venue", "speakers", "organization", "other".

Respond ONLY with valid JSON in this exact structure without extra text or markdown formatting:
{
  "sentiment": "positive",
  "topic": "content"
}
`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout limit

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`[AI Service API Error] HTTP ${response.status}: ${errBody}`);
      return {
        sentiment: 'Not analysed',
        topic: 'Not analysed',
        is_mismatch: false,
        ai_status: 'failed',
        reason: `API returned HTTP ${response.status}`
      };
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = extractJsonFromText(responseText);

    if (!parsed) {
      console.warn('[AI Service] Failed to parse JSON from AI response:', responseText);
      return {
        sentiment: 'Not analysed',
        topic: 'Not analysed',
        is_mismatch: false,
        ai_status: 'invalid_json',
        reason: 'AI output was not valid JSON'
      };
    }

    // STRICT VALIDATION AGAINST ALLOWED ENUM VALUES
    let sentiment = String(parsed.sentiment || '').toLowerCase();
    let topic = String(parsed.topic || '').toLowerCase();

    if (!VALID_SENTIMENTS.includes(sentiment)) {
      console.warn(`[AI Service] Rejected invalid sentiment from AI: "${parsed.sentiment}"`);
      sentiment = 'Not analysed';
    }

    if (!VALID_TOPICS.includes(topic)) {
      console.warn(`[AI Service] Rejected invalid topic from AI: "${parsed.topic}"`);
      topic = 'Not analysed';
    }

    // Check mismatch if sentiment was valid
    const isMismatch = (sentiment !== 'Not analysed') ? detectRatingMismatch(rating, sentiment) : false;

    return {
      sentiment,
      topic,
      is_mismatch: isMismatch,
      ai_status: 'success'
    };

  } catch (error) {
    console.error('[AI Service Exception]', error.name === 'AbortError' ? 'Timeout after 6s' : error.message);
    return {
      sentiment: 'Not analysed',
      topic: 'Not analysed',
      is_mismatch: false,
      ai_status: 'error',
      reason: error.message
    };
  }
}

/**
 * Generate Executive AI Summary for recent feedback entries
 */
export async function generateExecutiveSummary(feedbackList, customApiKey = null) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (!feedbackList || feedbackList.length === 0) {
    return {
      summary: "No feedback comments available to summarize.",
      key_takeaways: ["Encourage attendees to submit feedback forms."],
      top_praises: [],
      areas_for_improvement: [],
      recommendations: ["Collect at least 5-10 responses for meaningful trend analysis."]
    };
  }

  // Format comments into text block
  const commentsFormatted = feedbackList.map((f, idx) => 
    `${idx + 1}. [Rating: ${f.rating}/5 | Topic: ${f.topic} | Sentiment: ${f.sentiment}] "${f.comment}"`
  ).join('\n');

  if (!apiKey) {
    return generateFallbackSummary(feedbackList);
  }

  const promptText = `
You are an executive event manager and AI analytics specialist. 
Summarize the following ${feedbackList.length} feedback responses collected from the event:

${commentsFormatted}

Output MUST be valid JSON with this schema:
{
  "summary": "Short 2-3 sentence high-level overview of overall attendee sentiment and major themes.",
  "key_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "top_praises": ["Praise item 1", "Praise item 2"],
  "areas_for_improvement": ["Issue item 1", "Issue item 2"],
  "recommendations": ["Action item 1 for next event", "Action item 2 for next event"]
}
`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = extractJsonFromText(responseText);
      if (parsed && parsed.summary) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[AI Summary Exception]', err.message);
  }

  return generateFallbackSummary(feedbackList);
}

/**
 * Algorithmic Fallback Summary when AI API is unavailable
 */
function generateFallbackSummary(feedbackList) {
  const total = feedbackList.length;
  const avgRating = (feedbackList.reduce((acc, f) => acc + f.rating, 0) / total).toFixed(1);

  const posCount = feedbackList.filter(f => f.sentiment === 'positive').length;
  const negCount = feedbackList.filter(f => f.sentiment === 'negative').length;

  const topicFreq = {};
  feedbackList.forEach(f => {
    if (f.topic && f.topic !== 'Not analysed') {
      topicFreq[f.topic] = (topicFreq[f.topic] || 0) + 1;
    }
  });

  const sortedTopics = Object.entries(topicFreq).sort((a, b) => b[1] - a[1]);
  const topTopic = sortedTopics[0] ? sortedTopics[0][0] : 'general topics';

  return {
    summary: `Based on ${total} analyzed feedback submissions, the event achieved an average rating of ${avgRating}/5 stars. ${posCount} attendees reported positive experiences, while ${negCount} highlighted critical issues, with "${topTopic}" being the most discussed area.`,
    key_takeaways: [
      `Overall event satisfaction stands at ${avgRating}/5 across ${total} reviews.`,
      `Most discussed topic area: ${topTopic.toUpperCase()} (${topicFreq[topTopic] || 0} comments).`,
      `${posCount} positive reviews vs ${negCount} negative concerns identified.`
    ],
    top_praises: feedbackList.filter(f => f.rating >= 4).map(f => `[${f.topic}] ${f.comment}`).slice(0, 3),
    areas_for_improvement: feedbackList.filter(f => f.rating <= 2 || f.sentiment === 'negative').map(f => `[${f.topic}] ${f.comment}`).slice(0, 3),
    recommendations: [
      `Prioritize resolving reported complaints regarding ${topTopic}.`,
      `Maintain and expand high-scoring aspects like speaker lineup and workshop content.`,
      `Re-analyze unclassified responses once backend AI service key is configured.`
    ]
  };
}
