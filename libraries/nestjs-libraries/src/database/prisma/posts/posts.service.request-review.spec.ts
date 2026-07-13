jest.mock('@gitroom/helpers/utils/sanitize.post.content', () => ({
  sanitizePostContent: (value: unknown) => value,
}));

jest.mock('@gitroom/nestjs-libraries/services/make.is', () => ({
  makeId: () => 'mock-id',
}));

const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();

jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    set: (...args: unknown[]) => mockRedisSet(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
  },
}));

jest.mock('@gitroom/helpers/utils/strip.html.validation', () => ({
  stripHtmlValidation: (_type: string, value: string) => value,
}));

jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
}));

jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: {
    createStorage: () => ({}),
  },
}));

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/media/media.service',
  () => ({
    MediaService: class MediaService {},
  })
);

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({
    IntegrationService: class IntegrationService {},
  })
);

jest.mock('@gitroom/nestjs-libraries/short-linking/short.link.service', () => ({
  ShortLinkService: class ShortLinkService {},
}));

jest.mock('@gitroom/nestjs-libraries/openai/openai.service', () => ({
  OpenaiService: class OpenaiService {},
}));

jest.mock('nestjs-temporal-core', () => ({
  TemporalService: class TemporalService {},
}));

jest.mock(
  '@gitroom/nestjs-libraries/integrations/refresh.integration.service',
  () => ({
    RefreshIntegrationService: class RefreshIntegrationService {},
  })
);

import { BadRequestException } from '@nestjs/common';
import { State } from '@prisma/client';
import { PostsService } from './posts.service';

describe('PostsService.requestReview', () => {
  const postRepository = {
    getDraftPostForReview: jest.fn(),
  };
  const organizationRepository = {
    getEnabledOrgMembers: jest.fn(),
  };
  const usersRepository = {
    getUserById: jest.fn(),
  };
  const notificationService = {
    notifyRecipientMembers: jest.fn(),
  };

  const service = new PostsService(
    postRepository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    notificationService as any,
    organizationRepository as any,
    usersRepository as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisSet.mockResolvedValue('OK');
    mockRedisDel.mockResolvedValue(1);
    usersRepository.getUserById.mockResolvedValue({
      id: 'requester-1',
      name: 'Requester',
      email: 'requester@example.com',
    });
    notificationService.notifyRecipientMembers.mockResolvedValue({
      inAppNotified: 1,
      emailsEnqueued: 1,
      emailsFailed: 0,
    });
  });

  it('rejects posts outside the organization', async () => {
    postRepository.getDraftPostForReview.mockResolvedValue(null);

    await expect(
      service.requestReview('org-1', 'requester-1', 'post-1')
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-draft posts', async () => {
    postRepository.getDraftPostForReview.mockResolvedValue({
      id: 'post-1',
      state: State.QUEUE,
      content: '[]',
      publishDate: new Date(),
      integration: { name: 'Main', providerIdentifier: 'x' },
      organization: { name: 'Org' },
    });

    await expect(
      service.requestReview('org-1', 'requester-1', 'post-1')
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('excludes the requester and notifies only other enabled members', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    postRepository.getDraftPostForReview.mockResolvedValue({
      id: 'post-1',
      state: State.DRAFT,
      content: JSON.stringify([{ content: payload }]),
      publishDate: new Date('2026-07-12T12:00:00.000Z'),
      integration: { name: payload, providerIdentifier: 'x' },
      organization: { name: payload },
    });
    organizationRepository.getEnabledOrgMembers.mockResolvedValue([
      {
        user: {
          id: 'user-2',
          email: 'user-2@example.com',
          sendSuccessEmails: true,
          sendFailureEmails: true,
        },
      },
    ]);

    const result = await service.requestReview(
      'org-1',
      'requester-1',
      'post-1'
    );

    expect(organizationRepository.getEnabledOrgMembers).toHaveBeenCalledWith(
      'org-1',
      'requester-1'
    );
    expect(notificationService.notifyRecipientMembers).toHaveBeenCalledWith(
      'org-1',
      expect.stringContaining(payload),
      expect.stringContaining('&lt;img src=x onerror=alert(1)&gt;'),
      expect.stringContaining('&lt;img src=x onerror=alert(1)&gt;'),
      [
        {
          id: 'user-2',
          email: 'user-2@example.com',
          sendSuccessEmails: true,
          sendFailureEmails: true,
        },
      ],
      'info'
    );
    expect(result).toEqual({
      success: true,
      notified: 1,
      emailsEnqueued: 1,
      emailsFailed: 0,
    });
  });

  it('rejects duplicate review requests during the cooldown', async () => {
    postRepository.getDraftPostForReview.mockResolvedValue({
      id: 'post-1',
      state: State.DRAFT,
      content: '[]',
      publishDate: new Date(),
      integration: { name: 'Main', providerIdentifier: 'x' },
      organization: { name: 'Org' },
    });
    mockRedisSet.mockResolvedValue(null);

    await expect(
      service.requestReview('org-1', 'requester-1', 'post-1')
    ).rejects.toMatchObject({ status: 409 });
    expect(organizationRepository.getEnabledOrgMembers).not.toHaveBeenCalled();
    expect(notificationService.notifyRecipientMembers).not.toHaveBeenCalled();
  });
});
