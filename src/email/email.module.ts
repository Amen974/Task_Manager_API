import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

@Module({
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
