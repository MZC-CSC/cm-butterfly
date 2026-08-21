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

export function loadE2eConfig(): void {
  if (loaded) return;
  loaded = true;

  const file = path.resolve(__dirname, '..', 'e2e.config');
  if (!fs.existsSync(file)) return;

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
