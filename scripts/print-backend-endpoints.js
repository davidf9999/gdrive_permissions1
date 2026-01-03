const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const projectRoot = path.join(__dirname, '..');
const openapiPath = path.join(projectRoot, 'backend', 'openapi.yaml');

function normalizeText(value) {
  if (!value) {
    return '';
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

function main() {
  const raw = fs.readFileSync(openapiPath, 'utf8');
  const spec = yaml.load(raw);
  const paths = spec?.paths || {};

  Object.entries(paths).forEach(([route, methods]) => {
    if (!methods || typeof methods !== 'object') {
      return;
    }

    Object.entries(methods).forEach(([method, op]) => {
      if (!op || typeof op !== 'object') {
        return;
      }
      const summary = normalizeText(op.summary);
      const description = normalizeText(op.description);
      console.log(
        `${method.toUpperCase()} ${route}\t${summary}\t${description}`,
      );
    });
  });
}

main();
