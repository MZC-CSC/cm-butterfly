import fs from 'fs';
import path from 'path';
import { RUN_ID } from './naming';

/**
 * What one segment leaves behind for the next.
 *
 * The integration scenario is recorded a segment at a time, and each segment is its own run - a
 * fresh browser, a fresh process, nothing remembered. So the things a later segment needs to know
 * (above all *which* infrastructure the workflow actually created) have to outlive the run that
 * learned them.
 *
 * Without this the later segments had to guess the name. The workflow names the infra from the
 * prefix it was given, so `awsb` plus the default `infra101` happens to come out as
 * `awsb-infra101` - and every segment after it went looking for that literal string. It works only
 * as long as nothing about the naming changes, and it says nothing about whether the thing found is
 * the one this run created or a leftover from a previous one.
 *
 * Keyed by RUN_ID so two runs never read each other's notes.
 */
const FILE = path.join(
  process.env.E2E_HANDOFF_DIR || '/tmp',
  `e2e-handoff-${RUN_ID}.json`,
);

type Notes = Record<string, string>;

function read(): Notes {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Notes;
  } catch {
    return {};
  }
}

/** Record something a later segment will need. */
export function remember(key: string, value: string): void {
  const notes = read();
  notes[key] = value;
  fs.writeFileSync(FILE, JSON.stringify(notes, null, 2), 'utf-8');
  console.log(`[handoff] ${key} = ${value}`);
}

/** Read back what an earlier segment recorded, or undefined if it never ran. */
export function recall(key: string): string | undefined {
  return read()[key];
}
