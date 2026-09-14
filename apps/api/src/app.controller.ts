import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health') ping() {
    return { ok: true, ts: Date.now() };
  }
}
