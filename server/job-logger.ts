// Structured server-side logger for the research API.
// Emits one JSON object per line to .claude/logs/server.jsonl so failures
// caught by issues #24/#25/#26 can be traced after the fact with jq/grep.

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), '.claude', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.jsonl');

type Level = 'debug' | 'info' | 'warn' | 'error';

let dirReady = false;
function ensureLogDir() {
  if (dirReady) return;
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  dirReady = true;
}

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  ensureLogDir();
  const entry = { ts: new Date().toISOString(), level, event, ...fields };
  const line = JSON.stringify(entry) + '\n';
  try {
    appendFileSync(LOG_FILE, line, 'utf-8');
  } catch (e) {
    // Last-resort: never crash on logging failure.
    console.error('[job-logger] append failed:', e);
  }
  // Mirror warn/error to the dev-server console so they don't slip past during
  // live sessions, while debug/info stay quiet in the file.
  if (level === 'warn') console.warn(`[${event}]`, fields);
  else if (level === 'error') console.error(`[${event}]`, fields);
}

export const logPath = LOG_FILE;
