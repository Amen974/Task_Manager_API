import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { Job } from 'bullmq';

interface SendInvitationEmailData {
  email: string;
  inviterName: string;
  workspaceName: string;
  acceptUrl: string;
  declineUrl: string;
}

@Processor('email')
export class EmailProcessor extends WorkerHost {
  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<SendInvitationEmailData>): Promise<void> {
    await this.emailService.sendInvitationEmail(
      job.data.email,
      job.data.inviterName,
      job.data.workspaceName,
      job.data.acceptUrl,
      job.data.declineUrl,
    );
  }
}
