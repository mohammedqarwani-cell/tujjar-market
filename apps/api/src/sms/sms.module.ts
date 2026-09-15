import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { env } from '../env';

export abstract class SmsSender {
  abstract send(phone: string, text: string): Promise<void>;
}

/** Development only: prints messages to the server log instead of sending them. */
@Injectable()
export class ConsoleSmsSender extends SmsSender {
  private readonly log = new Logger('SMS');

  async send(phone: string, text: string) {
    this.log.warn(`(dev, not sent) +${phone}: ${text}`);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: SmsSender,
      useFactory: () => {
        if (env.isProd && !process.env.SMS_PROVIDER) {
          // A labelled public demo may run without an SMS provider; a real launch never may
          if (!env.demoMode) throw new Error('SMS_PROVIDER must be configured in production');
          new Logger('SMS').warn('DEMO_MODE: no SMS provider, verification codes are only logged and shown on screen');
        }
        return new ConsoleSmsSender();
      },
    },
  ],
  exports: [SmsSender],
})
export class SmsModule {}
