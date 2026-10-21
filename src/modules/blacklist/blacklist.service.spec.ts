import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import {
  BlacklistRepository,
  BlacklistRow,
  IdentityQuery,
} from './blacklist.repository';
import { BlacklistService } from './blacklist.service';
import { KarmaClient, KarmaUnavailableError } from './karma.client';

const identities: IdentityQuery[] = [
  { type: 'EMAIL', identity: 'ada@example.com' },
  { type: 'PHONE', identity: '+2348031234567' },
];

function setup({
  localMatch,
  karmaEnabled = true,
  lookup = jest.fn().mockResolvedValue('CLEAR'),
  failOpen = false,
}: {
  localMatch?: Partial<BlacklistRow>;
  karmaEnabled?: boolean;
  lookup?: jest.Mock;
  failOpen?: boolean;
}) {
  const repository = {
    findFirstMatch: jest.fn().mockResolvedValue(localMatch),
  } as unknown as BlacklistRepository;
  const karma = { enabled: karmaEnabled, lookup } as unknown as KarmaClient;
  const config = {
    get: () => failOpen,
  } as unknown as ConfigService<AppConfig, true>;
  return { service: new BlacklistService(repository, karma, config), lookup };
}

describe('BlacklistService.assertEligible', () => {
  it('passes when neither the local list nor Karma has a match', async () => {
    const { service, lookup } = setup({});
    await expect(service.assertEligible(identities)).resolves.toBeUndefined();
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('refuses a local blacklist match without calling Karma', async () => {
    const { service, lookup } = setup({
      localMatch: { identity_type: 'EMAIL' },
    });
    await expect(service.assertEligible(identities)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it('refuses when any Karma lookup is a hit', async () => {
    const lookup = jest
      .fn()
      .mockResolvedValueOnce('CLEAR')
      .mockResolvedValueOnce('HIT');
    const { service } = setup({ lookup });
    await expect(service.assertEligible(identities)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('skips Karma when it is disabled', async () => {
    const { service, lookup } = setup({ karmaEnabled: false });
    await expect(service.assertEligible(identities)).resolves.toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when Karma is unavailable', async () => {
    const lookup = jest
      .fn()
      .mockRejectedValue(new KarmaUnavailableError('down'));
    const { service } = setup({ lookup });
    await expect(service.assertEligible(identities)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('continues when Karma is unavailable and fail-open is configured', async () => {
    const lookup = jest
      .fn()
      .mockRejectedValue(new KarmaUnavailableError('down'));
    const { service } = setup({ lookup, failOpen: true });
    await expect(service.assertEligible(identities)).resolves.toBeUndefined();
  });

  it('does not swallow unexpected errors', async () => {
    const lookup = jest.fn().mockRejectedValue(new TypeError('bug'));
    const { service } = setup({ lookup, failOpen: true });
    await expect(service.assertEligible(identities)).rejects.toBeInstanceOf(
      TypeError,
    );
  });
});
