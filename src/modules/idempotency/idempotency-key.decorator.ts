import {
  applyDecorators,
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { IdempotentResult } from './idempotency.service';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const REPLAYED_HEADER = 'Idempotent-Replayed';

const KEY_FORMAT = /^[A-Za-z0-9_.:-]{8,255}$/;

/** Extracts and validates the required Idempotency-Key header. */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const value = ctx
      .switchToHttp()
      .getRequest<Request>()
      .header(IDEMPOTENCY_HEADER);
    if (!value) {
      throw new BadRequestException(`${IDEMPOTENCY_HEADER} header is required`);
    }
    if (!KEY_FORMAT.test(value)) {
      throw new BadRequestException(
        `${IDEMPOTENCY_HEADER} must be 8-255 characters of letters, digits, "_", "-", "." or ":" (a UUID is ideal)`,
      );
    }
    return value;
  },
);

/** Documents the header in Swagger. */
export const ApiIdempotencyKey = () =>
  applyDecorators(
    ApiHeader({
      name: IDEMPOTENCY_HEADER,
      required: true,
      description:
        'Unique per operation (a UUID is ideal). Retrying with the same key never repeats the operation; the original response is returned with the Idempotent-Replayed: true header.',
    }),
  );

/** Applies the stored status code and replay marker, returning the body. */
export function sendIdempotent<T>(
  res: Response,
  result: IdempotentResult<T>,
): T {
  res.status(result.status);
  if (result.replayed) res.setHeader(REPLAYED_HEADER, 'true');
  return result.body;
}
