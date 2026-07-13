jest.mock('nestjs-temporal-core', () => ({
  TemporalService: class TemporalService {
    client = {
      getRawClient: () => undefined,
    };
  },
}));

import { EmailService } from './email.service';

describe('EmailService.sendEmailSync', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM_ADDRESS: 'noreply@example.com',
      EMAIL_FROM_NAME: 'Postiz',
      FRONTEND_URL: 'https://example.com',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('escapes the subject in the HTML template but keeps the raw subject for the provider', async () => {
    const subject = '<img src=x onerror=alert(1)>';
    let providerSubject = '';
    let providerHtml = '';

    const service = new EmailService({} as any);
    service.emailService = {
      name: 'mock',
      validateEnvKeys: [],
      sendEmail: jest.fn(
        async (_to: string, subjectArg: string, html: string) => {
          providerSubject = subjectArg;
          providerHtml = html;
        }
      ),
    } as any;

    await service.sendEmailSync('user@example.com', subject, '<p>body</p>');

    expect(providerSubject).toBe(subject);
    expect(providerHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(providerHtml).not.toContain('<img src=x onerror=alert(1)>');
  });
});
