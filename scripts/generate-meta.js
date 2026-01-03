const { readFile, writeFile, stat } = require('fs/promises');
const { createHash } = require('crypto');
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KNOWLEDGE_PATH = path.join(ROOT, 'GPT_KNOWLEDGE.md');
const STEPS_PATH = path.join(ROOT, 'docs', 'common', 'steps.yaml');
const BUNDLE_PATH = path.join(ROOT, 'dist', 'apps_scripts_bundle.gs');
const USER_GUIDE_PATH = path.join(ROOT, 'docs', 'USER_GUIDE.md');
const SUPER_ADMIN_GUIDE_PATH = path.join(ROOT, 'docs', 'SUPER_ADMIN_USER_GUIDE.md');
const SHEET_EDITOR_GUIDE_PATH = path.join(ROOT, 'docs', 'SHEET_EDITOR_USER_GUIDE.md');
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
  const versionTag =
    process.env.VERSION_TAG ||
    process.env.GITHUB_REF_NAME ||
    safeGit('git describe --tags --abbrev=0', 'unknown');
  const gitSha =
    process.env.GIT_SHA ||
    process.env.GITHUB_SHA ||
    safeGit('git rev-parse HEAD', 'unknown');

  const meta = {
    service: process.env.SERVICE_NAME || 'gdrive-permissions-backend',
    version_tag: versionTag,
    git_sha: gitSha,
    build_time_utc: new Date().toISOString(),
    artifacts: {
      knowledge_sha256: await hashFile(KNOWLEDGE_PATH),
      steps_sha256: await hashFile(STEPS_PATH),
      bundle_sha256: await hashFile(BUNDLE_PATH),
      user_guide_sha256: await hashFile(USER_GUIDE_PATH),
      super_admin_guide_sha256: await hashFile(SUPER_ADMIN_GUIDE_PATH),
      sheet_editor_guide_sha256: await hashFile(SHEET_EDITOR_GUIDE_PATH),
    },
  };

  await writeFile(META_PATH, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`meta.json generated at ${META_PATH}`);
}

main().catch((err) => {
  console.error('Failed to generate meta.json', err);
  process.exit(1);
});
