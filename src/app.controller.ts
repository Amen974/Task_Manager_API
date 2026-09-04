import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  @Get('health')
  @Public()
  healthCheck(): { status: string } {
    return { status: 'ok' };
  }
}
