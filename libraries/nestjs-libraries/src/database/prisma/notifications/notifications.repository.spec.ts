import { NotificationsRepository } from './notifications.repository';

describe('NotificationsRepository recipient filtering', () => {
  const notificationsModel = {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  };
  const userModel = {
    findFirst: jest.fn(),
    update: jest.fn(),
  };

  const repository = new NotificationsRepository(
    { model: { notifications: notificationsModel } } as any,
    { model: { user: userModel } } as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
    userModel.findFirst.mockResolvedValue({
      lastReadNotifications: new Date('2026-01-01T00:00:00.000Z'),
    });
    userModel.update.mockResolvedValue({});
    notificationsModel.count.mockResolvedValue(0);
    notificationsModel.findMany.mockResolvedValue([]);
  });

  it('scopes authenticated counts to org-wide or current-user notifications', async () => {
    await repository.getMainPageCount('org-1', 'user-1');

    expect(notificationsModel.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: 'org-1',
        OR: [{ recipientId: null }, { recipientId: 'user-1' }],
      }),
    });
  });

  it('scopes public pagination to org-wide notifications only', async () => {
    await repository.getNotificationsPaginated('org-1', 0);

    expect(notificationsModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          recipientId: null,
        }),
      })
    );
  });

  it('creates recipient-targeted notifications with recipientId', async () => {
    await repository.createNotification('org-1', 'hello', 'user-2');

    expect(notificationsModel.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        content: 'hello',
        recipientId: 'user-2',
      },
    });
  });
});
