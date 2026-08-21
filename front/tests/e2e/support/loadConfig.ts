/**
 * Loads `e2e.config` (gitignored) into `process.env` at startup.
 *
 * Values already present in the environment win, so a one-off run can point somewhere else:
 *   BASE_URL=http://other-host npm run test:e2e
 *
 * A missing file is not an error — every value has a default or is only needed by the
 * scenarios that use it. Copy `e2e.config.example` to get started.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

let loaded = false;

function findConfig(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ['e2e.config', path.join('tests', 'e2e', 'e2e.config')]) {
      const candidate = path.join(dir, rel);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function loadE2eConfig(): void {
  if (loaded) return;
  loaded = true;

  // Resolved by walking up from the working directory rather than from this file: the suite is
  // loaded as an ES module in some entry points (bddgen) and as CommonJS in others, and `__dirname`
  // only exists in one of them.
  const file = findConfig();
  if (!file) return;

  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.startsWith('~/')) value = path.join(os.homedir(), value.slice(2));

    // Explicit environment wins.
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

loadE2eConfig();
