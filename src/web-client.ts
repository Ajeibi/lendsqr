import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** The demo client (Next.js static export, see web/) served at /app. */
export const WEB_CLIENT_ROUTE = '/app';
export const WEB_CLIENT_DIR = join(__dirname, '..', 'web', 'out');

export interface WebClientBuild {
  dir: string;
  /** SHA-256 sources for the export's inline scripts, e.g. 'sha256-...'. */
  scriptHashes: string[];
}

/**
 * Returns the built client, or null when web/out hasn't been built (the API
 * runs fine without it, e.g. in tests or API-only deployments).
 */
export function loadWebClient(dir = WEB_CLIENT_DIR): WebClientBuild | null {
  const hashesFile = join(dir, 'csp-hashes.json');
  if (!existsSync(join(dir, 'index.html')) || !existsSync(hashesFile)) {
    return null;
  }
  const { scriptHashes } = JSON.parse(readFileSync(hashesFile, 'utf8')) as {
    scriptHashes: string[];
  };
  return { dir, scriptHashes };
}
