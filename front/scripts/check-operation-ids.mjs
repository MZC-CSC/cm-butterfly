#!/usr/bin/env node
/**
 * Verify that every operationId the console calls actually exists in api.yaml.
 *
 * Why this exists: the console never calls REST endpoints directly. It posts to
 * `/api/{operationId}` and the backend uses api.yaml to proxy that to the right
 * subframework. The backend used to fall back to searching every service when an
 * operationId had no `{service}/` prefix, so a missing prefix (for example
 * `list-task-component` instead of `cm-cicada/list-task-component`) still worked
 * by accident. That fallback is gone, so an unprefixed call is now a plain 404 —
 * and on screen a 404 usually just looks like an empty list, which is easy to miss.
 *
 * So catch it statically instead. This applies the same rule the backend does —
 * `{service}/{operationId}`, case-insensitive — and fails on any name that is
 * unknown or is missing its service prefix.
 *
 * Run: npm run check:opids
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const FRONT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const API_YAML = join(FRONT, '..', 'api', 'conf', 'api.yaml');
const SRC = join(FRONT, 'src');
const E2E = join(FRONT, 'tests', 'e2e');

/** Endpoints the api server handles itself. They are not proxied, so they are not in api.yaml. */
const LOCAL_ENDPOINTS = new Set([
  'auth/login',
  'auth/logout',
  'auth/validate',
  'auth/refresh',
  'getmenutree',
  'getapiyaml',
]);

/** String constants that are not operationIds (request envelope keys, flags, and such). */
const NOT_OPERATION_IDS = new Set([
  'data',
  'request',
  'pathParams',
  'queryParams',
  'targetInfra',
  'onpremiseInfraModel',
  'true',
  'false',
  'model1',
  'model2',
  'nsId',
]);

const spec = yaml.load(readFileSync(API_YAML, 'utf8'));
const serviceActions = spec?.serviceActions ?? {};

/** Backend lookup key: `{service}/{operationId}`, lowercased. */
const validKeys = new Set();
/** Bare operationId -> owning service, used to report a missing prefix. */
const opToService = new Map();
for (const [service, ops] of Object.entries(serviceActions)) {
  for (const op of Object.keys(ops ?? {})) {
    validKeys.add(`${service}/${op}`.toLowerCase());
    opToService.set(op.toLowerCase(), service);
  }
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|vue)$/.test(entry)) out.push(p);
  }
  return out;
}

// An operationId reaches the API layer two ways, and both have shipped a bug, so check both.
//
//   1. via a constant:  const GET_X = 'cm-cicada/list-workflow';   useAxiosPost(GET_X, ...)
//   2. passed inline:   useAxiosPost<...>('cm-grasshopper/Get-Migration-List', {...})
//
// An earlier version of this script only looked at (1). It passed clean while
// `useAxiosPost<...>('Get-Migration-List', ...)` sat there unprefixed and 404ing, which silently
// broke the whole software-migration recommendation. Both forms are checked now.
const CONST_RE = /\bconst\s+([A-Z_][A-Z0-9_]*)\s*(?::[^=]+?)?=\s*'([^']+)'/g;
const INLINE_RE = /\buseAxios(?:Post|Get|Put|Delete)\s*(?:<[\s\S]*?>)?\s*\(\s*'([^']+)'/g;
// The e2e tests hit the same proxy directly (`/api/{operationId}`), and they have shipped the same
// missing-prefix bug (PostCmdInfra), so scan them with the same rule.
const E2E_URL_RE = /\/api\/([A-Za-z][A-Za-z0-9/_-]*)`/g;

const problems = [];
let checked = 0;

/** Judge one operationId literal found in `file` under the label `name`. */
function inspect(file, name, value) {
  if (NOT_OPERATION_IDS.has(value)) return;
  const lower = value.toLowerCase();
  if (LOCAL_ENDPOINTS.has(lower)) return;

  if (value.includes('/')) {
    checked++;
    if (!validKeys.has(lower)) {
      problems.push({
        file: relative(FRONT, file),
        name,
        value,
        why: 'not found in api.yaml',
      });
    }
  } else if (opToService.has(lower)) {
    // Written without a prefix but it does exist under a service, so calling it 404s.
    problems.push({
      file: relative(FRONT, file),
      name,
      value,
      why: `missing service prefix — should be '${opToService.get(lower)}/${value}'`,
    });
  }
}

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  for (const [, name, value] of source.matchAll(CONST_RE)) inspect(file, name, value);
  for (const [, value] of source.matchAll(INLINE_RE)) inspect(file, '(inline)', value);
}

for (const file of walk(E2E)) {
  const source = readFileSync(file, 'utf8');
  for (const [, value] of source.matchAll(E2E_URL_RE)) inspect(file, '(e2e /api call)', value);
}

if (problems.length > 0) {
  console.error(`\nx operationId check failed — ${problems.length} problem(s)\n`);
  for (const p of problems) {
    console.error(`  ${p.file}`);
    console.error(`    ${p.name} = '${p.value}'`);
    console.error(`    -> ${p.why}\n`);
  }
  console.error(`Checked against ${validKeys.size} operationIds declared in api.yaml.\n`);
  process.exit(1);
}

console.log(
  `v operationId check passed — ${checked} prefixed call(s) all present in api.yaml (${validKeys.size} declared).`,
);
