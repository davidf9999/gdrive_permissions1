const { readFile, writeFile, stat } = require('fs/promises');
const { createHash } = require('crypto');
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KNOWLEDGE_PATH = path.join(ROOT, 'GPT_KNOWLEDGE.md');
const STEPS_PATH = path.join(ROOT, 'docs', 'common', 'steps.yaml');
const BUNDLE_PATH = path.join(ROOT, 'dist', 'apps_scripts_bundle.gs');
const META_PATH = path.join(ROOT, 'meta.json');

async function hashFile(filePath) {
  const fileInfo = await stat(filePath);
  if (!fileInfo.isFile()) {
    throw new Error(`Expected file at ${filePath}`);
  }

  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function safeGit(cmd, fallback) {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (err) {
    return fallback;
  }
}

async function main() {
  const meta = {
    service: process.env.SERVICE_NAME || 'gdrive-permissions-backend',
    version_tag: safeGit('git describe --tags --abbrev=0', 'unknown'),
    git_sha: safeGit('git rev-parse HEAD', 'unknown'),
    build_time_utc: new Date().toISOString(),
    artifacts: {
      knowledge_sha256: await hashFile(KNOWLEDGE_PATH),
      steps_sha256: await hashFile(STEPS_PATH),
      bundle_sha256: await hashFile(BUNDLE_PATH),
    },
  };

  await writeFile(META_PATH, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`meta.json generated at ${META_PATH}`);
}

main().catch((err) => {
  console.error('Failed to generate meta.json', err);
  process.exit(1);
});
