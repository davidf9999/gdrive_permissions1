const http = require('http');
const { readFile, stat } = require('fs/promises');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const BASE_DIR = path.resolve(__dirname, '..');
const MAX_BYTES = 2 * 1024 * 1024; // 2MB safety limit

const allowedExtensions = new Set(['.md', '.gs']);
const allowlistFiles = new Set([
  path.join(BASE_DIR, 'GPT_KNOWLEDGE.md'),
  path.join(BASE_DIR, 'dist', 'apps_scripts_bundle.gs'),
]);

function isAllowed(resolvedPath) {
  if (!resolvedPath.startsWith(BASE_DIR)) {
    return false;
  }
  const ext = path.extname(resolvedPath).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    return false;
  }
  if (ext === '.md') {
    return true; // allow markdown anywhere inside repo
  }
  return allowlistFiles.has(resolvedPath);
}

function contentTypeFor(ext) {
  switch (ext) {
    case '.md':
      return 'text/markdown; charset=utf-8';
    case '.gs':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

async function handleFileRequest(req, res) {
  const parsed = url.parse(req.url, true);
  const requestPath = parsed.query.path;

  if (!requestPath || typeof requestPath !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing path query parameter' }));
    return;
  }

  const resolvedPath = path.resolve(BASE_DIR, requestPath);
  if (!isAllowed(resolvedPath)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Access denied for requested file' }));
    return;
  }

  try {
    const fileStat = await stat(resolvedPath);
    if (!fileStat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not a file' }));
      return;
    }
    if (fileStat.size > MAX_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File too large' }));
      return;
    }

    const data = await readFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': contentTypeFor(ext),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(data);
  } catch (err) {
    console.error('Error serving file', err);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'File not found' }));
  }
}

function requestHandler(req, res) {
  const parsed = url.parse(req.url);
  if (parsed.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (parsed.pathname === '/file' && req.method === 'GET') {
    handleFileRequest(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

http.createServer(requestHandler).listen(PORT, () => {
  console.log(`GPT backend listening on :${PORT}`);
});
