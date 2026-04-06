import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from '@core/filters/all-exceptions.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  /** Firma paciente en base64 supera el límite por defecto (~100kb) de `express.json`. */
  const bodyLimit = process.env.HTTP_BODY_LIMIT ?? '15mb';
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  if (!isProd) {
    app.useGlobalFilters(new AllExceptionsFilter());
  }
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
  });
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}

bootstrap();
