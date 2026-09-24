import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Regenerates the OpenAPI schema from FastAPI and the TypeScript types from
// that schema, then fails if either differs from what is committed.
const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
const generatedPaths = ['packages/api-client/openapi.json', 'packages/api-client/src/generated'];

function run(description, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`Failed to ${description}.`);
    console.error(result.stderr || result.stdout || result.error?.message);
    process.exit(result.status || 1);
  }
  return result.stdout;
}

run('export the OpenAPI schema from the FastAPI app', python, ['apps/api/scripts/export_openapi.py']);
run('generate TypeScript types from the OpenAPI schema', 'pnpm', ['--filter', '@app/api-client', 'generate']);

// Compare against the index so regenerated-and-staged files pass locally, and
// list untracked files explicitly because `git diff` does not report them.
const changed = run('diff generated artifacts', 'git', ['diff', '--', ...generatedPaths]);
const untracked = run('list untracked generated artifacts', 'git', [
  'ls-files',
  '--others',
  '--exclude-standard',
  '--',
  ...generatedPaths,
]);

if (changed.trim() || untracked.trim()) {
  console.error('Generated contract artifacts differ from the committed version.');
  console.error(changed || `Untracked files:\n${untracked}`);
  console.error('Review the regenerated files and commit them.');
  process.exit(1);
}

console.log('Generated contract artifacts are up to date.');
