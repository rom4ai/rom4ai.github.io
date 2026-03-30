// ROM4AI Metrics API - Cloudflare Worker
// Handles post views and ratings for Jekyll blog

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Helper: Create JSON response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}

// Helper: Parse request body
async function parseBody(request) {
  try {
    const text = await request.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Helper: Sanitize post ID
function sanitizePostId(id) {
  if (!id || typeof id !== 'string') return null;
  // Remove any potentially dangerous characters, keep only safe URL chars
  return id.replace(/[^a-zA-Z0-9-_/]/g, '').slice(0, 256);
}

// Helper: Get KV keys for a post
function getKeys(postId) {
  const base = `post:${postId}`;
  return {
    views: `${base}:views`,
    ratings: `${base}:ratings`,
    ratingSum: `${base}:rating_sum`
  };
}

// GET /post-metrics?id={postId}
async function getPostMetrics(request, env) {
  const url = new URL(request.url);
  const postId = sanitizePostId(url.searchParams.get('id'));
  
  if (!postId) {
    return jsonResponse({ error: 'Missing or invalid post ID' }, 400);
  }
  
  const keys = getKeys(postId);
  
  // Get current values from KV
  const [viewsRaw, ratingsRaw, ratingSumRaw] = await Promise.all([
    env.METRICS_KV.get(keys.views),
    env.METRICS_KV.get(keys.ratings),
    env.METRICS_KV.get(keys.ratingSum)
  ]);
  
  const views = parseInt(viewsRaw) || 0;
  const ratingCount = parseInt(ratingsRaw) || 0;
  const ratingSum = parseInt(ratingSumRaw) || 0;
  const ratingAverage = ratingCount > 0 ? ratingSum / ratingCount : 0;
  
  return jsonResponse({
    views,
    ratingCount,
    ratingAverage: Math.round(ratingAverage * 10) / 10 // Round to 1 decimal
  });
}

// POST /post-view
async function trackPostView(request, env) {
  const body = await parseBody(request);
  const postId = sanitizePostId(body?.postId);
  
  if (!postId) {
    return jsonResponse({ error: 'Missing or invalid post ID' }, 400);
  }
  
  const keys = getKeys(postId);
  
  // Increment view count
  const currentViews = parseInt(await env.METRICS_KV.get(keys.views)) || 0;
  await env.METRICS_KV.put(keys.views, String(currentViews + 1));
  
  // Get updated metrics
  const [ratingsRaw, ratingSumRaw] = await Promise.all([
    env.METRICS_KV.get(keys.ratings),
    env.METRICS_KV.get(keys.ratingSum)
  ]);
  
  const ratingCount = parseInt(ratingsRaw) || 0;
  const ratingSum = parseInt(ratingSumRaw) || 0;
  const ratingAverage = ratingCount > 0 ? ratingSum / ratingCount : 0;
  
  return jsonResponse({
    views: currentViews + 1,
    ratingCount,
    ratingAverage: Math.round(ratingAverage * 10) / 10
  });
}

// POST /post-rating
async function submitPostRating(request, env) {
  const body = await parseBody(request);
  const postId = sanitizePostId(body?.postId);
  const rating = parseInt(body?.rating);
  
  if (!postId) {
    return jsonResponse({ error: 'Missing or invalid post ID' }, 400);
  }
  
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return jsonResponse({ error: 'Rating must be an integer between 1 and 5' }, 400);
  }
  
  const keys = getKeys(postId);
  
  // Get current values
  const [viewsRaw, ratingsRaw, ratingSumRaw] = await Promise.all([
    env.METRICS_KV.get(keys.views),
    env.METRICS_KV.get(keys.ratings),
    env.METRICS_KV.get(keys.ratingSum)
  ]);
  
  const views = parseInt(viewsRaw) || 0;
  const currentRatings = parseInt(ratingsRaw) || 0;
  const currentSum = parseInt(ratingSumRaw) || 0;
  
  // Update rating data
  const newRatings = currentRatings + 1;
  const newSum = currentSum + rating;
  
  await Promise.all([
    env.METRICS_KV.put(keys.ratings, String(newRatings)),
    env.METRICS_KV.put(keys.ratingSum, String(newSum))
  ]);
  
  const ratingAverage = newSum / newRatings;
  
  return jsonResponse({
    views,
    ratingCount: newRatings,
    ratingAverage: Math.round(ratingAverage * 10) / 10
  });
}

// Main handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // Route requests
      if (path === '/post-metrics' && request.method === 'GET') {
        return await getPostMetrics(request, env);
      }
      
      if (path === '/post-view' && request.method === 'POST') {
        return await trackPostView(request, env);
      }
      
      if (path === '/post-rating' && request.method === 'POST') {
        return await submitPostRating(request, env);
      }
      
      // Health check
      if (path === '/health') {
        return jsonResponse({ status: 'ok', service: 'rom4ai-metrics' });
      }
      
      // 404 for unknown paths
      return jsonResponse({ error: 'Not found' }, 404);
      
    } catch (error) {
      console.error('Error handling request:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  }
};
