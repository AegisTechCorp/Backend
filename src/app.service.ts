import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): object {
    return {
      status: 'ok',
      message: 'Aegis API Running',
      version: '1.0.0',
    };
  }
}
