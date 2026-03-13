#!/usr/bin/env node
/**
 * Post-build step: adds .js extensions to relative imports in compiled ESM output.
 *
 * This lets the source code use clean extensionless imports (e.g. from '../index')
 * while the compiled output works with Node.js ESM module resolution which requires
 * explicit file extensions.
 *
 * Usage: node scripts/fix-esm-imports.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function fixImports(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      fixImports(full);
    } else if (full.endsWith('.js')) {
      let content = readFileSync(full, 'utf8');
      // Add .js to relative imports/exports that don't already have a JS file extension.
      // Only skip paths that already end with a real module extension (.js, .mjs, .cjs, .json).
      // Paths like device.repo, profile.repo, etc. are NOT file extensions and must get .js appended.
      // Handles: from './x', import('./x'), import './x' (side-effect imports)
      content = content.replace(
        /((?:from|import\(|import)\s*['"])(\.\.?\/[^'"]+?)(['"])/g,
        (match, prefix, path, suffix) => {
          if (/\.(js|mjs|cjs|json)$/.test(path)) return match;
          return `${prefix}${path}.js${suffix}`;
        }
      );
      writeFileSync(full, content);
    }
  }
}

fixImports('dist-server');
