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
const META_PATH = path.join(ROOT, 'meta.json');
const GITHUB_HEAD_URL =
  process.env.GITHUB_HEAD_URL ||
  'https://api.github.com/repos/davidf9999/gdrive_permissions1/commits/main';
const STATIC_CACHE_CONTROL =
  process.env.STATIC_CACHE_CONTROL || 'public, max-age=300';
const LATEST_CACHE_MS = Number(process.env.LATEST_CACHE_MS || 60_000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN || null;

let stepsIndex = [];
let stepsById = new Map();
let metaCache;
let latestCache;

function applyCacheHeaders(res, options = {}) {
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
  applyCacheHeaders(res, options);
  res.end();
}

function jsonResponse(res, statusCode, body, options = {}) {
  if (res.writableEnded) {
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  applyCacheHeaders(res, {
    cacheControl: options.cacheControl || 'no-cache, no-store, must-revalidate',
    etag: options.etag,
  });
  res.end(JSON.stringify(body));
}

function textResponse(res, statusCode, body, contentType, options = {}) {
  if (res.writableEnded) {
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  applyCacheHeaders(res, {
    cacheControl: options.cacheControl || 'no-cache, no-store, must-revalidate',
    etag: options.etag,
  });
  res.end(body);
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

async function handleMeta(res) {
  const meta = await loadMeta();
  jsonResponse(res, 200, meta);
}

async function handleKnowledge(req, res) {
  const meta = await loadMeta();
  const etag = meta.artifacts?.knowledge_sha256;

  if (isFresh(req, etag)) {
    notModified(res, { cacheControl: STATIC_CACHE_CONTROL, etag });
    return;
  }

  const content = await readFile(KNOWLEDGE_PATH, 'utf8');
  textResponse(res, 200, content, 'text/markdown; charset=utf-8', {
    cacheControl: STATIC_CACHE_CONTROL,
    etag,
  });
}

async function handleSteps(req, res) {
  const meta = await loadMeta();
  const etag = meta.artifacts?.steps_sha256;

  if (isFresh(req, etag)) {
    notModified(res, { cacheControl: STATIC_CACHE_CONTROL, etag });
    return;
  }

  jsonResponse(res, 200, stepsIndex, {
    cacheControl: STATIC_CACHE_CONTROL,
    etag,
  });
}

async function handleStepDetail(req, res, stepId) {
  if (!stepId) {
    jsonResponse(res, 404, { error: 'not_found', message: 'Step not found' });
    return;
  }

  const step = stepsById.get(stepId);
  if (!step) {
    jsonResponse(res, 404, { error: 'not_found', message: 'Step not found' });
    return;
  }

  const meta = await loadMeta();
  const etag = meta.artifacts?.steps_sha256;

  if (isFresh(req, etag)) {
    notModified(res, { cacheControl: STATIC_CACHE_CONTROL, etag });
    return;
  }

  jsonResponse(res, 200, step, {
    cacheControl: STATIC_CACHE_CONTROL,
    etag,
  });
}

async function handleBundle(req, res) {
  const meta = await loadMeta();
  const etag = meta.artifacts?.bundle_sha256;

  if (isFresh(req, etag)) {
    notModified(res, { cacheControl: STATIC_CACHE_CONTROL, etag });
    return;
  }

  const bundle = await readFile(BUNDLE_PATH, 'utf8');
  textResponse(res, 200, bundle, 'text/plain; charset=utf-8', {
    cacheControl: STATIC_CACHE_CONTROL,
    etag,
  });
}

function readLatestCache() {
  if (latestCache && Date.now() - latestCache.timestamp < LATEST_CACHE_MS) {
    return latestCache.payload;
  }
  return null;
}

async function handleLatest(res) {
  const meta = await loadMeta();

  const cached = readLatestCache();
  if (cached) {
    jsonResponse(res, 200, cached, {
      cacheControl: `public, max-age=${Math.floor(LATEST_CACHE_MS / 1000)}`,
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
    });
  }
}

async function routeRequest(req, res) {
  const startedAt = Date.now();
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  res.on('finish', () => logRequest(req, res, startedAt, requestId));

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
      jsonResponse(res, 200, { status: 'ok' });
      return;
    }

    if (req.method === 'GET' && normPath === '/meta') {
      await handleMeta(res);
      return;
    }

    if (req.method === 'GET' && normPath === '/knowledge') {
      await handleKnowledge(req, res);
      return;
    }

    if (req.method === 'GET' && normPath === '/steps') {
      await handleSteps(req, res);
      return;
    }

    if (req.method === 'GET' && normPath.startsWith('/steps/')) {
      const stepId = decodeURIComponent(normPath.replace('/steps/', ''));
      await handleStepDetail(req, res, stepId);
      return;
    }

    if (req.method === 'GET' && normPath === '/bundle') {
      await handleBundle(req, res);
      return;
    }

    if (req.method === 'GET' && normPath === '/latest') {
      await handleLatest(res);
      return;
    }

    jsonResponse(res, 404, { error: 'not_found', message: 'Resource not found' });
  } catch (err) {
    console.error('Unhandled error', err);
    jsonResponse(res, 500, {
      error: 'internal_error',
      message: 'Unexpected server error',
    });
  }
}

async function bootstrap() {
  await loadSteps();
  await loadMeta();

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
