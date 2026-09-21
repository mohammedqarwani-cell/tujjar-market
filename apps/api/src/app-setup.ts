import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Everything the running API applies around the modules: proxy trust, security headers, cookie
 * parsing, body limits, CORS, input validation and the error filter. Tests build the app through
 * the same function, so they exercise the request pipeline the deployment uses.
 */
export function configureApp(app: NestExpressApplication) {
  app.set('trust proxy', env.trustProxy);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '200kb' });
  app.useBodyParser('urlencoded', { limit: '50kb', extended: false });

  app.enableCors({
    origin: [...new Set(Object.values(env.origins).flat())],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  return app;
}
