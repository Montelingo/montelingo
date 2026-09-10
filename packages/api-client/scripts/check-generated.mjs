import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const openApiPath = path.join(root, 'packages', 'api-client', 'openapi.json');
const generatedPath = path.join(root, 'packages', 'api-client', 'src', 'generated', 'index.ts');

const exportResult = spawnSync('py', ['apps/api/scripts/export_openapi.py'], {
  cwd: root,
  encoding: 'utf8',
});

if (exportResult.status !== 0) {
  console.error('Failed to regenerate OpenAPI schema from FastAPI app.');
  console.error(exportResult.stderr || exportResult.stdout);
  process.exit(exportResult.status || 1);
}

const generateResult = spawnSync('node', ['packages/api-client/scripts/generate-client.mjs'], {
  cwd: root,
  encoding: 'utf8',
});

if (generateResult.status !== 0) {
  console.error('Failed to regenerate TypeScript API types.');
  console.error(generateResult.stderr || generateResult.stdout);
  process.exit(generateResult.status || 1);
}

const openApiText = fs.readFileSync(openApiPath, 'utf8');
const generatedText = fs.readFileSync(generatedPath, 'utf8');
const generatedMarker = 'export type ErrorEnvelope';

if (!openApiText.includes('"openapi":') || !generatedText.includes(generatedMarker)) {
  console.error('Generated contract artifacts are missing or stale.');
  process.exit(1);
}

const gitDiff = spawnSync('git', ['diff', '--exit-code', '--', 'packages/api-client/openapi.json', 'packages/api-client/src/generated/index.ts'], {
  cwd: root,
  encoding: 'utf8',
});

if (gitDiff.status !== 0) {
  console.error('Generated contract artifacts differ from the committed version.');
  console.error(gitDiff.stdout || gitDiff.stderr);
  process.exit(1);
}

console.log('Generated contract artifacts are up to date.');
