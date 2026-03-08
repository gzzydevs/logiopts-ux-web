/**
 * Centralized data directory paths.
 *
 * When running inside Electron, `LOGITUX_DATA_DIR` is set to
 * `app.getPath('userData')` (~/.local/share/logitux/).
 * In standalone / dev mode the fallback is `<cwd>/data` for the DB
 * and `<cwd>/scripts` for user scripts.
 */

import { resolve } from 'node:path';

export const DATA_DIR = process.env.LOGITUX_DATA_DIR
  ?? resolve(process.cwd(), 'data');

export const SCRIPTS_DIR = process.env.LOGITUX_DATA_DIR
  ? resolve(process.env.LOGITUX_DATA_DIR, 'scripts')
  : resolve(process.cwd(), 'scripts');

export const DB_PATH = resolve(DATA_DIR, 'logitux.db');
