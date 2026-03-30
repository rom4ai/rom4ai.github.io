# ROM4AI Metrics API

Cloudflare Worker API for tracking blog post views and ratings.

## Endpoints

### GET /post-metrics?id={postId}
Get metrics for a specific post.

**Response:**
```json
{
  "views": 42,
  "ratingCount": 5,
  "ratingAverage": 4.2
}
```

### POST /post-view
Track a page view.

**Request:**
```json
{
  "postId": "/2026/03/11/taalas-model-specialized-hardware"
}
```

**Response:** Same as GET /post-metrics

### POST /post-rating
Submit a rating.

**Request:**
```json
{
  "postId": "/2026/03/11/taalas-model-specialized-hardware",
  "rating": 5
}
```

**Response:** Same as GET /post-metrics

## Deployment

1. Install Wrangler:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Create KV namespace:
```bash
wrangler kv:namespace create "METRICS_KV"
```

4. Update `wrangler.toml` with your KV namespace ID.

5. Deploy:
```bash
wrangler deploy
```

6. Copy the worker URL and set it in `_config.yml`:
```yaml
post_metrics_endpoint: "https://rom4ai-metrics.your-subdomain.workers.dev"
```

## Local Development

```bash
npm run dev
```

## View Logs

```bash
npm run tail
```
