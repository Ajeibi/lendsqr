import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const swagger = new DocumentBuilder()
    .setTitle('Lendsqr Wallet Service')
    .setDescription(
      'User accounts, wallets and wallet-to-wallet transfers. Amounts are in kobo. ' +
        'Prefer clicking? Try the [demo client](/app/).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = app.get(ConfigService<AppConfig, true>).get('port', {
    infer: true,
  });
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
