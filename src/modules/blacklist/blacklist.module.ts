import { Module } from '@nestjs/common';
import { BlacklistRepository } from './blacklist.repository';
import { BlacklistService } from './blacklist.service';
import { KarmaClient } from './karma.client';

@Module({
  providers: [BlacklistRepository, BlacklistService, KarmaClient],
  exports: [BlacklistService, BlacklistRepository],
})
export class BlacklistModule {}
