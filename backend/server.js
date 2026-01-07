const http = require('http');
const { readFile } = require('fs/promises');
const crypto = require('crypto');
const path = require('path');
const yaml = require('js-yaml');
const { URL } = require('url');

const PORT = process.env.PORT || 8080;
const ROOT = path.resolve(__dirname, '..');
const KNOWLEDGE_PATH = path.join(ROOT, 'GPT_KNOWLEDGE.md');
const STEPS_PATH = path.join(ROOT, 'docs', 'common', 'steps.yaml');
const BUNDLE_PATH = path.join(ROOT, 'dist', 'apps_scripts_bundle.gs');
const USER_GUIDE_PATH = path.join(ROOT, 'docs', 'USER_GUIDE.md');
const SUPER_ADMIN_GUIDE_PATH = path.join(ROOT, 'docs', 'SUPER_ADMIN_USER_GUIDE.md');
const SHEET_EDITOR_GUIDE_PATH = path.join(
  ROOT,
  'docs',
  'SHEET_EDITOR_USER_GUIDE.md',
);
const META_PATH = path.join(ROOT, 'meta.json');
const GITHUB_HEAD_URL =
  process.env.GITHUB_HEAD_URL ||
  'https://api.github.com/repos/davidf9999/gdrive_permissions1/commits/main';
const STATIC_CACHE_CONTROL =
  process.env.STATIC_CACHE_CONTROL || 'public, max-age=300';
const LATEST_CACHE_MS = Number(process.env.LATEST_CACHE_MS || 60_000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN || null;
const DEFAULT_ALLOWED_ORIGINS =
  process.env.ALLOWED_ORIGINS ||
  process.env.ALLOWED_ORIGIN ||
  'https://chatgpt.com,https://chat.openai.com';
const ALLOWED_ORIGINS = DEFAULT_ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || null;
const ALLOW_ANON = process.env.ALLOW_ANON === 'true';
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 0);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_STORE = new Map();

let stepsIndex = [];
let stepsById = new Map();
let metaCache;
let latestCache;

const USAGE_DOCS = {
  overview: {
    path: USER_GUIDE_PATH,
    etagKey: 'user_guide_sha256',
  },
  'super-admin': {
    path: SUPER_ADMIN_GUIDE_PATH,
    etagKey: 'super_admin_guide_sha256',
  },
  'sheet-editor': {
    path: SHEET_EDITOR_GUIDE_PATH,
    etagKey: 'sheet_editor_guide_sha256',
  },
};

function applyStandardHeaders(res, options = {}) {
  const allowedOrigin = options.allowedOrigin || ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);

  if (options.cacheControl) {
    res.setHeader('Cache-Control', options.cacheControl);
  }

  if (options.etag) {
    res.setHeader('ETag', options.etag);
  }
}

function isFresh(req, etag) {
  const ifNoneMatch = req.headers['if-none-match'];
  return Boolean(etag && ifNoneMatch && ifNoneMatch === etag);
}

function notModified(res, options = {}) {
  if (res.writableEnded) {
    return;
  }
  res.statusCode = 304;
  applyStandardHeaders(res, options);
  res.end();
}

function jsonResponse(res, statusCode, body, options = {}) {
  if (res.writableEnded) {
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  applyStandardHeaders(res, {
    cacheControl: options.cacheControl || 'no-cache, no-store, must-revalidate',
    etag: options.etag,
    allowedOrigin: options.allowedOrigin,
  });
  res.end(JSON.stringify(body));
}

function textResponse(res, statusCode, body, contentType, options = {}) {
  if (res.writableEnded) {
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  applyStandardHeaders(res, {
    cacheControl: options.cacheControl || 'no-cache, no-store, must-revalidate',
    etag: options.etag,
    allowedOrigin: options.allowedOrigin,
  });
  res.end(body);
}

function getAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return ALLOWED_ORIGINS[0];
}

function sanitizeHeaders(headers) {
  const redactedHeaders = {};
  const redactKeys = new Set(['authorization', 'x-api-key', 'cookie']);

  Object.entries(headers || {}).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (redactKeys.has(lowerKey)) {
      redactedHeaders[key] = '[redacted]';
    } else {
      redactedHeaders[key] = value;
    }
  });

  return redactedHeaders;
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function extractApiKey(req) {
  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.trim()) {
    const [scheme, token] = authHeader.split(' ');
    if (scheme && token && scheme.toLowerCase() === 'bearer') {
      return token.trim();
    }
  }

  return null;
}

function checkRateLimit(req) {
  if (!RATE_LIMIT_MAX || RATE_LIMIT_MAX <= 0) {
    return null;
  }

  const now = Date.now();
  const clientId = getClientIp(req);
  const entry = RATE_LIMIT_STORE.get(clientId);

  if (!entry || now >= entry.resetAt) {
    RATE_LIMIT_STORE.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return {
      limited: false,
      remaining: RATE_LIMIT_MAX - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return {
      limited: true,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  return {
    limited: false,
    remaining: RATE_LIMIT_MAX - entry.count,
    resetAt: entry.resetAt,
  };
}

function handleDebug(req, res, requestId, allowedOrigin) {
  jsonResponse(res, 200, {
    method: req.method,
    path: req.url,
    request_id: requestId,
    timestamp_utc: new Date().toISOString(),
    headers: sanitizeHeaders(req.headers),
  }, { allowedOrigin });
}

async function loadMeta() {
  if (!metaCache) {
    const raw = await readFile(META_PATH, 'utf8');
    metaCache = JSON.parse(raw);
  }
  return metaCache;
}

async function loadSteps() {
  const raw = await readFile(STEPS_PATH, 'utf8');
  const parsed = yaml.load(raw);
  const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];

  stepsIndex = steps.map((step) => {
    const compact = {
      id: step.id,
      title: step.title,
      manual: Boolean(step.manual),
    };

    if (step.state) {
      compact.state = step.state;
    }

    return compact;
  });

  stepsById = new Map(
    steps.map((step) => [
      step.id,
      {
        id: step.id,
        title: step.title,
        manual: Boolean(step.manual),
        setup_guide_markdown: step.setup_guide || '',
        state: step.state,
      },
    ]),
  );
}

function logRequest(req, res, startedAt, requestId) {
  const latencyMs = Date.now() - startedAt;
  const payload = {
    severity: res.statusCode >= 500 ? 'ERROR' : 'INFO',
    request_id: requestId,
    method: req.method,
    path: req.url,
    status: res.statusCode,
    latency_ms: latencyMs,
  };
  console.log(JSON.stringify(payload));
}

async function handleMeta(res, allowedOrigin) {
  const meta = await loadMeta();
  jsonResponse(res, 200, meta, { allowedOrigin });
}

async function handleKnowledge(req, res, allowedOrigin) {
  const meta = await loadMeta();
  const etag = meta.artifacts?.knowledge_sha256;

  if (isFresh(req, etag)) {
    notModified(res, { cacheControl: STATIC_CACHE_CONTROL, etag, allowedOrigin });
    return;
  }

  const content = await readFile(KNOWLEDGE_PATH, 'utf8');
  textResponse(res, 200, content, 'text/markdown; charset=utf-8', {
    cacheControl: STATIC_CACHE_CONTROL,
    etag,
    allowedOrigin,
  });
}

async function handleUsageDoc(req, res, docKey, allowedOrigin) {
  const usageDoc = USAGE_DOCS[docKey];
  if (!usageDoc) {
    jsonResponse(res, 404, { error: 'not_found', message: 'Resource not found' }, { allowedOrigin });
    return;
  }

  const meta = await loadMeta();
  const etag = meta.artifacts?.[usageDoc.etagKey];

  if (isFresh(req, etag)) {
    notModified(res, { cacheControl: STATIC_CACHE_CONTROL, etag, allowedOrigin });
    return;
  }

  const content = await readFile(usageDoc.path, 'utf8');
  textResponse(res, 200, content, 'text/markdown; charset=utf-8', {
    cacheControl: STATIC_CACHE_CONTROL,
    etag,
    allowedOrigin,
  });
}

async function handleSteps(req, res, allowedOrigin) {
  const meta = await loadMeta();
  const etag = meta.artifacts?.steps_sha256;

  if (isFresh(req, etag)) {
    notModified(res, { cacheControl: STATIC_CACHE_CONTROL, etag, allowedOrigin });
    return;
  }

  jsonResponse(res, 200, stepsIndex, {
    cacheControl: STATIC_CACHE_CONTROL,
    etag,
    allowedOrigin,
  });
}

async function handleStepDetail(req, res, stepId, allowedOrigin) {
  if (!stepId) {
    jsonResponse(res, 404, { error: 'not_found', message: 'Step not found' }, { allowedOrigin });
    return;
  }

  const step = stepsById.get(stepId);
  if (!step) {
    jsonResponse(res, 404, { error: 'not_found', message: 'Step not found' }, { allowedOrigin });
    return;
  }

  const meta = await loadMeta();
  const etag = meta.artifacts?.steps_sha256;

  if (isFresh(req, etag)) {
    notModified(res, { cacheControl: STATIC_CACHE_CONTROL, etag, allowedOrigin });
    return;
  }

  jsonResponse(res, 200, step, {
    cacheControl: STATIC_CACHE_CONTROL,
    etag,
    allowedOrigin,
  });
}

async function handleBundle(req, res, allowedOrigin) {
  const meta = await loadMeta();
  const etag = meta.artifacts?.bundle_sha256;

  if (isFresh(req, etag)) {
    notModified(res, { cacheControl: STATIC_CACHE_CONTROL, etag, allowedOrigin });
    return;
  }

  const bundle = await readFile(BUNDLE_PATH, 'utf8');
  textResponse(res, 200, bundle, 'text/plain; charset=utf-8', {
    cacheControl: STATIC_CACHE_CONTROL,
    etag,
    allowedOrigin,
  });
}

function readLatestCache() {
  if (latestCache && Date.now() - latestCache.timestamp < LATEST_CACHE_MS) {
    return latestCache.payload;
  }
  return null;
}

async function handleLatest(res, allowedOrigin) {
  const meta = await loadMeta();

  const cached = readLatestCache();
  if (cached) {
    jsonResponse(res, 200, cached, {
      cacheControl: `public, max-age=${Math.floor(LATEST_CACHE_MS / 1000)}`,
      allowedOrigin,
    });
    return;
  }

  try {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'gdrive-permissions-backend',
    };

    if (GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    const response = await fetch(GITHUB_HEAD_URL, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`GitHub returned status ${response.status}`);
    }

    const data = await response.json();
    const githubSha = data?.sha || data?.commit?.sha || null;
    const payload = {
      status: 'ok',
      deployed_git_sha: meta.git_sha,
    };

    if (githubSha) {
      payload.github_head_sha = githubSha;
      payload.is_outdated = Boolean(meta.git_sha && githubSha !== meta.git_sha);
    }

    latestCache = { timestamp: Date.now(), payload };
    jsonResponse(res, 200, payload, {
      cacheControl: `public, max-age=${Math.floor(LATEST_CACHE_MS / 1000)}`,
      allowedOrigin,
    });
  } catch (err) {
    const payload = {
      status: 'unknown',
      deployed_git_sha: meta.git_sha,
      reason: err.message,
    };
    latestCache = { timestamp: Date.now(), payload };
    jsonResponse(res, 200, payload, {
      cacheControl: `public, max-age=${Math.floor(LATEST_CACHE_MS / 1000)}`,
      allowedOrigin,
    });
  }
}

async function routeRequest(req, res) {
  const startedAt = Date.now();
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  res.on('finish', () => logRequest(req, res, startedAt, requestId));

  const allowedOrigin = getAllowedOrigin(req);

  // Handle CORS preflight requests before auth.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400', // 24 hours
    });
    res.end();
    return;
  }

  // Enforce API key authentication unless explicitly allowing anonymous access.
  if (!ALLOW_ANON) {
    if (!BACKEND_API_KEY) {
      jsonResponse(res, 500, {
        error: 'misconfigured',
        message: 'BACKEND_API_KEY is required unless ALLOW_ANON=true.',
      }, { allowedOrigin });
      return;
    }

    const providedKey = extractApiKey(req);
    if (providedKey !== BACKEND_API_KEY) {
      jsonResponse(res, 401, {
        error: 'unauthorized',
        message: 'Missing or invalid API key.',
      }, { allowedOrigin });
      return;
    }
  }

  const rateLimit = checkRateLimit(req);
  if (rateLimit?.limited) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
    );
    res.setHeader('Retry-After', String(retryAfterSeconds));
    jsonResponse(res, 429, {
      error: 'rate_limited',
      message: 'Too many requests. Please retry later.',
    }, { allowedOrigin });
    return;
  }

  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathName = parsedUrl.pathname;
  const normPath =
    pathName.endsWith('/') && pathName.length > 1
      ? pathName.slice(0, -1)
      : pathName;

  console.log(
    JSON.stringify({
      level: 'DEBUG',
      message: 'Routing request',
      raw_url: req.url,
      pathname: pathName,
      norm_path: normPath,
    }),
  );

  try {
    if (req.method === 'GET' && normPath === '/status') {
      jsonResponse(res, 200, { status: 'ok' }, { allowedOrigin });
      return;
    }

    if (req.method === 'GET' && normPath === '/debug') {
      if (process.env.NODE_ENV !== 'development') {
        jsonResponse(res, 404, { error: 'not_found' }, { allowedOrigin });
        return;
      }
      handleDebug(req, res, requestId, allowedOrigin);
      return;
    }

    if (req.method === 'GET' && normPath === '/meta') {
      await handleMeta(res, allowedOrigin);
      return;
    }

    if (req.method === 'GET' && normPath === '/knowledge') {
      await handleKnowledge(req, res, allowedOrigin);
      return;
    }

    if (req.method === 'GET' && normPath === '/usage/overview') {
      await handleUsageDoc(req, res, 'overview', allowedOrigin);
      return;
    }

    if (req.method === 'GET' && normPath === '/usage/super-admin') {
      await handleUsageDoc(req, res, 'super-admin', allowedOrigin);
      return;
    }

    if (req.method === 'GET' && normPath === '/usage/sheet-editor') {
      await handleUsageDoc(req, res, 'sheet-editor', allowedOrigin);
      return;
    }

    if (req.method === 'GET' && normPath === '/steps') {
      await handleSteps(req, res, allowedOrigin);
      return;
    }

    if (req.method === 'GET' && normPath.startsWith('/steps/')) {
      const stepId = decodeURIComponent(normPath.replace('/steps/', ''));
      await handleStepDetail(req, res, stepId, allowedOrigin);
      return;
    }

    if (req.method === 'GET' && normPath === '/bundle') {
      await handleBundle(req, res, allowedOrigin);
      return;
    }

    if (req.method === 'GET' && normPath === '/latest') {
      await handleLatest(res, allowedOrigin);
      return;
    }

    jsonResponse(res, 404, { error: 'not_found', message: 'Resource not found' }, { allowedOrigin });
  } catch (err) {
    console.error('Unhandled error', err);
    jsonResponse(res, 500, {
      error: 'internal_error',
      message: 'Unexpected server error',
    }, { allowedOrigin });
  }
}

async function bootstrap() {
  await loadSteps();
  await loadMeta();

  if (ALLOW_ANON) {
    console.warn('WARNING: ALLOW_ANON is enabled. Authentication is disabled.');
  }

  const server = http.createServer((req, res) => {
    routeRequest(req, res);
  });

  server.listen(PORT, () => {
    console.log(`GPT backend listening on :${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
