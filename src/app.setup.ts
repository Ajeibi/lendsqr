import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { ServerResponse } from 'http';
import { WEB_CLIENT_ROUTE, WebClientBuild, loadWebClient } from './web-client';

/** HTTP-level setup shared by main.ts and the e2e tests. */
export function configureApp(
  app: NestExpressApplication,
  webClient: WebClientBuild | null = loadWebClient(),
): void {
  // Render terminates TLS at its proxy; trust it so client IPs (rate limiting) are real.
  app.set('trust proxy', 1);
  useSecurityHeaders(app, webClient);
  if (webClient) serveWebClient(app, webClient);
  app.enableCors();
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}

/**
 * Helmet everywhere. The demo client gets the same headers, except its
 * script-src also allows the export's inline scripts by their SHA-256 hash
 * (computed at build time), so no 'unsafe-inline' is ever needed.
 */
function useSecurityHeaders(
  app: NestExpressApplication,
  webClient: WebClientBuild | null,
): void {
  const apiHeaders = helmet();
  if (!webClient) {
    app.use(apiHeaders);
    return;
  }

  const clientHeaders = helmet({
    contentSecurityPolicy: {
      directives: { scriptSrc: ["'self'", ...webClient.scriptHashes] },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    isWebClientPath(req.path)
      ? clientHeaders(req, res, next)
      : apiHeaders(req, res, next),
  );
}

/** Registered after the security headers, so every static response carries them. */
function serveWebClient(
  app: NestExpressApplication,
  webClient: WebClientBuild,
): void {
  app.useStaticAssets(webClient.dir, {
    prefix: WEB_CLIENT_ROUTE,
    setHeaders: (res: ServerResponse, filePath: string) => {
      // Hashed build assets never change; pages must always be revalidated.
      res.setHeader(
        'Cache-Control',
        /[\\/]_next[\\/]static[\\/]/.test(filePath)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      );
    },
  });
  // Anything under /app the export doesn't have gets its "page not found"
  // screen, rather than the API's JSON 404.
  app.use(
    WEB_CLIENT_ROUTE,
    (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.status(404).sendFile('404.html', { root: webClient.dir });
    },
  );
}

function isWebClientPath(path: string): boolean {
  return path === WEB_CLIENT_ROUTE || path.startsWith(`${WEB_CLIENT_ROUTE}/`);
}
