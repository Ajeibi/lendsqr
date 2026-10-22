import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadWebClient } from '../src/web-client';
import { createTestApp, TestContext } from './utils';

/** A minimal stand-in for `web/out`, so the test doesn't need a Next.js build. */
function fakeBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), 'web-out-'));
  writeFileSync(
    join(dir, 'index.html'),
    '<!doctype html><title>Wallet</title>',
  );
  mkdirSync(join(dir, 'wallet'));
  writeFileSync(
    join(dir, 'wallet', 'index.html'),
    '<!doctype html><title>W</title>',
  );
  writeFileSync(
    join(dir, '404.html'),
    '<!doctype html><title>Not found</title>',
  );
  mkdirSync(join(dir, '_next', 'static', 'chunks'), { recursive: true });
  writeFileSync(join(dir, '_next', 'static', 'chunks', 'app.js'), '1');
  writeFileSync(
    join(dir, 'csp-hashes.json'),
    JSON.stringify({ scriptHashes: ["'sha256-abc123='"] }),
  );
  return dir;
}

describe('Demo client at /app (e2e)', () => {
  let ctx: TestContext;
  let dir: string;

  beforeAll(async () => {
    dir = fakeBuild();
    ctx = await createTestApp(loadWebClient(dir));
  });

  afterAll(async () => {
    await ctx.app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves the exported pages, redirecting to the trailing-slash form', async () => {
    await ctx.http().get('/app').expect(301).expect('Location', '/app/');
    const res = await ctx.http().get('/app/').expect(200);
    expect(res.text).toContain('<title>Wallet</title>');
    await ctx.http().get('/app/wallet/').expect(200);
  });

  it('allows the inline scripts by hash only, never unsafe-inline', async () => {
    const res = await ctx.http().get('/app/').expect(200);
    const csp = res.headers['content-security-policy'];
    expect(csp).toMatch(/script-src 'self' 'sha256-abc123='/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('caches hashed build assets forever', async () => {
    const res = await ctx
      .http()
      .get('/app/_next/static/chunks/app.js')
      .expect(200);
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('leaves the API on the default strict policy', async () => {
    const res = await ctx.http().get('/health').expect(200);
    expect(res.headers['content-security-policy']).toMatch(
      /script-src 'self'(;|$)/,
    );
    expect(res.headers['content-security-policy']).not.toContain('sha256-');
  });

  it("serves the client's not-found page for unknown /app paths, with a 404", async () => {
    const res = await ctx.http().get('/app/no-such-page/').expect(404);
    expect(res.text).toContain('<title>Not found</title>');
    expect(res.headers['content-security-policy']).toMatch(/sha256-abc123=/);
  });

  it('is not served at all when the client has not been built', () => {
    expect(loadWebClient(join(dir, 'missing'))).toBeNull();
  });
});
