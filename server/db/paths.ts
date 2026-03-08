/**
 * Centralized path resolution for data, scripts, and DB.
 *
 * LOGITUX_DATA_DIR (set by Electron main process) points to the writable
 * user-data directory (~/.local/share/logitux). In standalone/dev mode
 * it is undefined, so we fall back to ./data relative to the project root.
 */

import { resolve } from 'node:path';

const dataDir = process.env.LOGITUX_DATA_DIR
  ?? resolve(process.cwd(), 'data');

export const DATA_DIR = dataDir;
export const SCRIPTS_DIR = resolve(dataDir, 'scripts');
export const DB_PATH = process.env.DB_PATH || resolve(dataDir, 'logitux.db');
