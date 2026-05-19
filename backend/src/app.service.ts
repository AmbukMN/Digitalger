import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'DigitalGer API';
  }

  health() {
    return {
      status: 'ok',
      service: 'digitalger-api',
      step: 1,
      timestamp: new Date().toISOString(),
    };
  }
}
