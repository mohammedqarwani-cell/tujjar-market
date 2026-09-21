import { Controller, Get, Module } from '@nestjs/common';

/**
 * The host's health check. It is the one route that answers without the proxy secret, so the
 * platform can tell a live instance from a dead one without holding a copy of the secret.
 */
@Controller('healthz')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
