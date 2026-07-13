import { NotificationService } from './notification.service';

describe('NotificationService.notifyRecipientMembers', () => {
  const notificationRepository = {
    createNotification: jest.fn(),
  };
  const emailService = {
    sendEmail: jest.fn(),
  };

  const service = new NotificationService(
    notificationRepository as any,
    emailService as any,
    {} as any,
    {} as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
    notificationRepository.createNotification.mockResolvedValue(undefined);
  });

  it('keeps in-app notifications when one recipient email fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    emailService.sendEmail
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce(undefined);

    const result = await service.notifyRecipientMembers(
      'org-1',
      'subject',
      '<b>in-app</b>',
      '<b>email</b>',
      [
        {
          id: 'user-1',
          email: 'one@example.com',
          sendSuccessEmails: true,
          sendFailureEmails: true,
        },
        {
          id: 'user-2',
          email: 'two@example.com',
          sendSuccessEmails: true,
          sendFailureEmails: true,
        },
      ]
    );

    expect(notificationRepository.createNotification).toHaveBeenCalledTimes(2);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalled();
    expect(result).toEqual({
      inAppNotified: 2,
      emailsEnqueued: 1,
      emailsFailed: 1,
    });
    consoleError.mockRestore();
  });

  it('keeps in-app notifications but skips email when both email preferences are disabled', async () => {
    const result = await service.notifyRecipientMembers(
      'org-1',
      'subject',
      '<b>in-app</b>',
      '<b>email</b>',
      [
        {
          id: 'user-1',
          email: 'one@example.com',
          sendSuccessEmails: false,
          sendFailureEmails: false,
        },
      ]
    );

    expect(notificationRepository.createNotification).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({
      inAppNotified: 1,
      emailsEnqueued: 0,
      emailsFailed: 0,
    });
  });
});
