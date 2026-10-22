// Runs after `next build`. The exported App Router pages contain small inline
// <script> blocks; a strict Content-Security-Policy blocks inline scripts
// unless each one is allowed by its hash. This collects the SHA-256 of every
// executable inline script in out/ and writes them to out/csp-hashes.json,
// which the API reads at boot to build the policy for /app.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../out/', import.meta.url));
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
// Data blocks (e.g. type="application/json") are never executed, so CSP ignores them.
const NON_EXECUTABLE_TYPE = /\stype=["'](?!text\/javascript|module)[^"']+["']/i;

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory()
        ? htmlFiles(join(dir, e.name))
        : e.name.endsWith('.html')
          ? [join(dir, e.name)]
          : [],
    ),
  );
  return nested.flat();
}

const hashes = new Set();
const files = await htmlFiles(OUT);
for (const file of files) {
  const html = await readFile(file, 'utf8');
  for (const [, attrs, body] of html.matchAll(INLINE_SCRIPT)) {
    if (!body || NON_EXECUTABLE_TYPE.test(attrs)) continue;
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
}

await writeFile(
  join(OUT, 'csp-hashes.json'),
  JSON.stringify({ scriptHashes: [...hashes].sort() }, null, 2) + '\n',
);
console.log(`csp-hashes: ${hashes.size} inline script hashes from ${files.length} pages`);
