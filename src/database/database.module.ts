import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';
import { AppConfig } from '../config/configuration';
import { buildKnexConfig } from './knex.config';

export const KNEX = Symbol('KNEX');

/** Injects the shared Knex instance: `@InjectKnex() private readonly db: Knex`. */
export const InjectKnex = () => Inject(KNEX);

@Global()
@Module({
  providers: [
    {
      provide: KNEX,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): Knex =>
        knex(buildKnexConfig(config.get('database', { infer: true }))),
    },
  ],
  exports: [KNEX],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@InjectKnex() private readonly db: Knex) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}
