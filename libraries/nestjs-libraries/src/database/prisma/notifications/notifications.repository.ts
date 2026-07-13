import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class NotificationsRepository {
  constructor(
    private _notifications: PrismaRepository<'notifications'>,
    private _user: PrismaRepository<'user'>
  ) {}

  private recipientFilterForUser(
    userId: string
  ): Prisma.NotificationsWhereInput {
    return {
      OR: [{ recipientId: null }, { recipientId: userId }],
    };
  }

  private orgWideOnlyFilter(): Prisma.NotificationsWhereInput {
    return { recipientId: null };
  }

  getLastReadNotification(userId: string) {
    return this._user.model.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        lastReadNotifications: true,
      },
    });
  }

  async getMainPageCount(organizationId: string, userId: string) {
    const { lastReadNotifications } = (await this.getLastReadNotification(
      userId
    ))!;

    return {
      total: await this._notifications.model.notifications.count({
        where: {
          organizationId,
          createdAt: {
            gt: lastReadNotifications!,
          },
          ...this.recipientFilterForUser(userId),
        },
      }),
    };
  }

  async createNotification(
    organizationId: string,
    content: string,
    recipientId?: string | null
  ) {
    await this._notifications.model.notifications.create({
      data: {
        organizationId,
        content,
        recipientId: recipientId ?? null,
      },
    });
  }

  async getNotificationsSince(organizationId: string, since: string) {
    return this._notifications.model.notifications.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(since),
        },
        ...this.orgWideOnlyFilter(),
      },
    });
  }

  async getNotificationsPaginated(
    organizationId: string,
    page: number,
    userId?: string
  ) {
    const limit = 100;
    const skip = page * limit;

    const where = {
      organizationId,
      deletedAt: null as Date | null,
      ...(userId
        ? this.recipientFilterForUser(userId)
        : this.orgWideOnlyFilter()),
    };

    const [notifications, total] = await Promise.all([
      this._notifications.model.notifications.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          content: true,
          link: true,
          createdAt: true,
        },
      }),
      this._notifications.model.notifications.count({ where }),
    ]);

    return {
      notifications,
      total,
      page,
      limit,
      hasMore: skip + notifications.length < total,
    };
  }

  async getNotifications(organizationId: string, userId: string) {
    const { lastReadNotifications } = (await this.getLastReadNotification(
      userId
    ))!;

    await this._user.model.user.update({
      where: {
        id: userId,
      },
      data: {
        lastReadNotifications: new Date(),
      },
    });

    return {
      lastReadNotifications,
      notifications: await this._notifications.model.notifications.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        where: {
          organizationId,
          ...this.recipientFilterForUser(userId),
        },
        select: {
          createdAt: true,
          content: true,
        },
      }),
    };
  }
}
