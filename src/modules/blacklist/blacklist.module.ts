import { Module } from '@nestjs/common';
import { BlacklistController } from './blacklist.controller';
import { BlacklistRepository } from './blacklist.repository';
import { BlacklistService } from './blacklist.service';
import { KarmaClient } from './karma.client';

@Module({
  controllers: [BlacklistController],
  providers: [BlacklistRepository, BlacklistService, KarmaClient],
  exports: [BlacklistService],
})
export class BlacklistModule {}
