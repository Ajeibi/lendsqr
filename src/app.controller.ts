import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/auth/decorators';

/** The bare service URL sends visitors to the API docs instead of a 404. */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller()
export class AppController {
  @Get()
  @Redirect('/docs', 302)
  root(): void {}
}
