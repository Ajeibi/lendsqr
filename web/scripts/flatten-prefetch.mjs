// Runs after `next build`. The static export writes per-segment prefetch
// payloads for nested routes into a folder (wallet/__next.wallet/__PAGE__.txt),
// but the client router requests them as one flat file name
// (wallet/__next.wallet.__PAGE__.txt), so a plain static server answers 404
// and the router falls back to a slower full fetch. This writes a copy of each
// nested payload under the flat name the client asks for.
import { copyFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../out/', import.meta.url));
const SEGMENT_DIR = /^__next\..+/;

/** Files under `dir`, as paths relative to it. */
async function filesIn(dir, prefix = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory()
        ? filesIn(join(dir, e.name), [...prefix, e.name])
        : [[...prefix, e.name]],
    ),
  );
  return nested.flat();
}

let copies = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    if (SEGMENT_DIR.test(entry.name)) {
      for (const parts of await filesIn(path)) {
        await copyFile(join(path, ...parts), join(dir, [entry.name, ...parts].join('.')));
        copies += 1;
      }
    } else {
      await walk(path);
    }
  }
}

await walk(OUT);
console.log(`flatten-prefetch: ${copies} segment payloads copied to flat names`);
