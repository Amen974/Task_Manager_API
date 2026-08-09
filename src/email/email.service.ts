import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailtrapClient } from 'mailtrap';
import { StringValue } from 'ms';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: MailtrapClient;

  constructor(private readonly configService: ConfigService) {
    this.client = new MailtrapClient({
      token: this.configService.get<string>('API_TOKEN') as StringValue,
      sandbox: this.configService.get<string>('NODE_ENV') !== 'production',
      testInboxId: Number(
        this.configService.get<string>('MAILTRAP_TEST_INBOX_ID'),
      ),
    });
  }

  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    const sender = {
      email:
        this.configService.get<string>('MAIL_FROM_ADDRESS') ??
        'hello@example.com',
      name: 'Task Manager',
    };

    try {
      await this.client.send({
        from: sender,
        to: [{ email: to }],
        subject,
        text,
        ...(html ? { html } : {}),
        category: 'Transactional',
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error as Error);
    }
  }

  async sendInvitationEmail(
    to: string,
    inviterName: string,
    workspaceName: string,
    acceptUrl: string,
    declineUrl: string,
  ): Promise<void> {
    const subject = `${inviterName} invited you to join ${workspaceName}`;
    const text = `${inviterName} is inviting you to join ${workspaceName}. Accept: ${acceptUrl} Decline: ${declineUrl}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <p style="font-size: 16px; color: #1a1a1a;">
          <strong>${inviterName}</strong> is inviting you to join <strong>${workspaceName}</strong>.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
          <tr>
            <td style="padding-right: 12px;">
              <a href="${acceptUrl}"
                 style="display: inline-block; padding: 10px 20px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Accept
              </a>
            </td>
            <td>
              <a href="${declineUrl}"
                 style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Decline
              </a>
            </td>
          </tr>
        </table>
        <p style="font-size: 12px; color: #666;">
          If you weren't expecting this invitation, you can ignore this email.
        </p>
      </div>
    `;

    await this.sendEmail(to, subject, text, html);
  }
}
