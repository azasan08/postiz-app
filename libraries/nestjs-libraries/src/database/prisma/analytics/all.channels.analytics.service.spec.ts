jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({
    IntegrationService: class IntegrationService {},
  })
);

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/posts/posts.service',
  () => ({
    PostsService: class PostsService {},
  })
);

import { AllChannelsAnalyticsService } from './all.channels.analytics.service';
import { AllChannelsAnalyticsDto } from '@gitroom/nestjs-libraries/dtos/analytics/all.channels.analytics.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

const mockedRedis = ioRedis as unknown as {
  get: jest.Mock;
  set: jest.Mock;
};

describe('AllChannelsAnalyticsService', () => {
  const org = { id: 'org-1' } as any;

  const makeService = (
    integrationService: any,
    postsService: any
  ): AllChannelsAnalyticsService =>
    new AllChannelsAnalyticsService(integrationService, postsService);

  beforeEach(() => {
    mockedRedis.get.mockReset();
    mockedRedis.set.mockReset();
    mockedRedis.get.mockResolvedValue(null);
    mockedRedis.set.mockResolvedValue('OK');
  });

  it('validates custom range 100 days allowed and 101 rejected', async () => {
    const ok = plainToInstance(AllChannelsAnalyticsDto, {
      from: '2026-01-01',
      to: '2026-04-10',
    });
    const bad = plainToInstance(AllChannelsAnalyticsDto, {
      from: '2026-01-01',
      to: '2026-04-11',
    });
    expect(await validate(ok)).toHaveLength(0);
    expect((await validate(bad)).length).toBeGreaterThan(0);
  });

  it('computes previous equal-length bounds and zero-baseline changes', () => {
    const service = makeService({}, {});
    expect(service.previousPeriod('2026-07-01', '2026-07-07')).toEqual({
      from: '2026-06-24',
      to: '2026-06-30',
    });
    expect(service.computePercentageChange(0, 0)).toEqual({
      percentageChange: 0,
      changeKind: 'percent',
    });
    expect(service.computePercentageChange(4, 0)).toEqual({
      percentageChange: null,
      changeKind: 'dash',
    });
    expect(service.computePercentageChange(null, 1)).toEqual({
      percentageChange: null,
      changeKind: 'na',
    });
  });

  it('does not convert null metrics to zero and gates eng rate', () => {
    const service = makeService({}, {});
    expect(service.computeEngRate(10, null, 100)).toBeNull();
    expect(service.computeEngRate(10, 5, null)).toBeNull();
    expect(service.computeEngRate(10, 5, 0)).toBeNull();
    expect(service.computeEngRate(10, 5, 100)).toBe(15);
  });

  it('ranks top posts by metric with newer publishDate as tiebreaker', () => {
    const service = makeService({}, {});
    const ranked = service.rankTopPosts(
      [
        {
          post: {
            id: 'a',
            content: 'a',
            image: null,
            publishDate: new Date('2026-07-01T00:00:00Z'),
            releaseURL: null,
            releaseId: '1',
            integration: {
              id: 'ig1',
              name: 'IG One',
              providerIdentifier: 'instagram',
              picture: null,
            },
          },
          reactions: 10,
          comments: 1,
          impressions: 100,
        },
        {
          post: {
            id: 'b',
            content: 'b',
            image: null,
            publishDate: new Date('2026-07-05T00:00:00Z'),
            releaseURL: null,
            releaseId: '2',
            integration: {
              id: 'ig2',
              name: 'IG Two',
              providerIdentifier: 'instagram',
              picture: null,
            },
          },
          reactions: 10,
          comments: 3,
          impressions: 100,
        },
        {
          post: {
            id: 'c',
            content: 'c',
            image: null,
            publishDate: new Date('2026-07-03T00:00:00Z'),
            releaseURL: null,
            releaseId: '3',
            integration: {
              id: 'x1',
              name: 'X',
              providerIdentifier: 'x',
              picture: null,
            },
          },
          reactions: null,
          comments: 9,
          impressions: 50,
        },
      ] as any,
      'reactions'
    );

    expect(ranked.map((p) => p.id)).toEqual(['b', 'a']);
    const byComments = service.rankTopPosts(
      [
        {
          post: {
            id: 'c',
            content: 'c',
            image: null,
            publishDate: new Date('2026-07-03T00:00:00Z'),
            releaseURL: null,
            releaseId: '3',
            integration: {
              id: 'x1',
              name: 'X',
              providerIdentifier: 'x',
              picture: null,
            },
          },
          reactions: null,
          comments: 9,
          impressions: 50,
        },
      ] as any,
      'comments'
    );
    expect(byComments[0].id).toBe('c');
  });

  it('keeps Instagram accounts as separate channels and tolerates one failure', async () => {
    const integrationService = {
      getIntegrationsList: jest.fn().mockResolvedValue([
        {
          id: 'ig1',
          name: 'IG One',
          providerIdentifier: 'instagram',
          picture: null,
          disabled: false,
          refreshNeeded: false,
          type: 'social',
        },
        {
          id: 'ig2',
          name: 'IG Two',
          providerIdentifier: 'instagram',
          picture: null,
          disabled: false,
          refreshNeeded: false,
          type: 'social',
        },
        {
          id: 'fb1',
          name: 'FB',
          providerIdentifier: 'facebook',
          picture: null,
          disabled: false,
          refreshNeeded: false,
          type: 'social',
        },
        {
          id: 'x1',
          name: 'X',
          providerIdentifier: 'x',
          picture: null,
          disabled: false,
          refreshNeeded: false,
          type: 'social',
        },
      ]),
      checkFollowers: jest.fn().mockImplementation(async (_org, id) => {
        if (id === 'fb1') {
          throw new Error('facebook failed');
        }
        return {
          current: id === 'x1' ? 50 : 100,
          series:
            id === 'x1'
              ? null
              : [
                  { date: '2026-06-24', value: 90 },
                  { date: '2026-07-07', value: 100 },
                ],
          growth:
            id === 'x1'
              ? null
              : [
                  { date: '2026-06-24', value: 1 },
                  { date: '2026-07-07', value: 2 },
                ],
          previous: id === 'x1' ? null : 90,
        };
      }),
    };

    const postsService = {
      getPublishedPostsForAnalytics: jest
        .fn()
        .mockImplementation(async (orgId: string, _from, _to, ids?: string[]) => {
          expect(orgId).toBe('org-1');
          const id = ids?.[0];
          if (id === 'ig1') {
            return [
              {
                id: 'p1',
                content: 'hello',
                image: JSON.stringify([{ path: '/a.jpg' }]),
                publishDate: new Date('2026-07-02T00:00:00Z'),
                releaseURL: 'https://ig/1',
                releaseId: 'r1',
                integration: {
                  id: 'ig1',
                  name: 'IG One',
                  providerIdentifier: 'instagram',
                  picture: null,
                },
              },
            ];
          }
          if (id === 'ig2') {
            return [
              {
                id: 'p2',
                content: 'world',
                image: null,
                publishDate: new Date('2026-07-03T00:00:00Z'),
                releaseURL: 'https://ig/2',
                releaseId: 'r2',
                integration: {
                  id: 'ig2',
                  name: 'IG Two',
                  providerIdentifier: 'instagram',
                  picture: null,
                },
              },
            ];
          }
          return [];
        }),
      checkPostAnalytics: jest.fn().mockImplementation(async (_org, postId) => {
        if (postId === 'p1') {
          return [
            { label: 'Likes', data: [{ total: '10', date: '2026-07-02' }] },
            { label: 'Comments', data: [{ total: '2', date: '2026-07-02' }] },
            { label: 'Views', data: [{ total: '100', date: '2026-07-02' }] },
          ];
        }
        return [
          { label: 'Likes', data: [{ total: '4', date: '2026-07-03' }] },
          { label: 'Comments', data: [{ total: '1', date: '2026-07-03' }] },
          { label: 'Views', data: [{ total: '40', date: '2026-07-03' }] },
        ];
      }),
    };

    const service = makeService(integrationService, postsService);
    const result = await service.getAllChannels(
      org,
      '2026-07-01',
      '2026-07-07'
    );

    expect(result.performance.map((p) => p.channelId).sort()).toEqual([
      'fb1',
      'ig1',
      'ig2',
      'x1',
    ]);
    expect(result.errors.some((e) => e.channelId === 'fb1')).toBe(true);
    expect(result.summary.reactions.value).toBe(14);
    expect(result.summary.comments.value).toBe(3);
    expect(
      result.performance.find((p) => p.channelId === 'fb1')?.comments
    ).toBeNull();
    expect(postsService.getPublishedPostsForAnalytics).toHaveBeenCalled();
    const orgIds = postsService.getPublishedPostsForAnalytics.mock.calls.map(
      (call: any[]) => call[0]
    );
    expect(orgIds.every((id: string) => id === 'org-1')).toBe(true);
  });

  it('returns cached payload without calling providers', async () => {
    const cached = {
      period: {
        current: { from: '2026-07-01', to: '2026-07-07' },
        previous: { from: '2026-06-24', to: '2026-06-30' },
      },
      summary: {},
      topPosts: { byReactions: [], byComments: [] },
      performance: [],
      followers: { channels: [], availability: {} },
      errors: [],
    };
    mockedRedis.get.mockResolvedValue(JSON.stringify(cached));

    const integrationService = {
      getIntegrationsList: jest.fn(),
      checkFollowers: jest.fn(),
    };
    const postsService = {
      getPublishedPostsForAnalytics: jest.fn(),
      checkPostAnalytics: jest.fn(),
    };

    const service = makeService(integrationService, postsService);
    const result = await service.getAllChannels(
      org,
      '2026-07-01',
      '2026-07-07'
    );

    expect(result).toEqual(cached);
    expect(integrationService.getIntegrationsList).not.toHaveBeenCalled();
    expect(postsService.checkPostAnalytics).not.toHaveBeenCalled();
  });

  it('does not exceed concurrency limits while loading post analytics', async () => {
    let active = 0;
    let maxActive = 0;
    const providerActive = new Map<string, number>();
    let maxProvider = 0;

    const integrationService = {
      getIntegrationsList: jest.fn().mockResolvedValue([
        {
          id: 'ig1',
          name: 'IG',
          providerIdentifier: 'instagram',
          picture: null,
          disabled: false,
          refreshNeeded: false,
          type: 'social',
        },
      ]),
      checkFollowers: jest.fn().mockResolvedValue({
        current: 10,
        series: null,
        growth: null,
        previous: null,
      }),
    };

    const posts = Array.from({ length: 8 }).map((_, index) => ({
      id: `p${index}`,
      content: `post ${index}`,
      image: null,
      publishDate: new Date('2026-07-02T00:00:00Z'),
      releaseURL: null,
      releaseId: `r${index}`,
      integration: {
        id: 'ig1',
        name: 'IG',
        providerIdentifier: 'instagram',
        picture: null,
      },
    }));

    const postsService = {
      getPublishedPostsForAnalytics: jest.fn().mockResolvedValue(posts),
      checkPostAnalytics: jest.fn().mockImplementation(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        const currentProvider = (providerActive.get('instagram') || 0) + 1;
        providerActive.set('instagram', currentProvider);
        maxProvider = Math.max(maxProvider, currentProvider);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
        providerActive.set(
          'instagram',
          (providerActive.get('instagram') || 1) - 1
        );
        return [
          { label: 'Likes', data: [{ total: '1', date: '2026-07-02' }] },
          { label: 'Comments', data: [{ total: '1', date: '2026-07-02' }] },
          { label: 'Views', data: [{ total: '10', date: '2026-07-02' }] },
        ];
      }),
    };

    const service = makeService(integrationService, postsService);
    await service.getAllChannels(org, '2026-07-01', '2026-07-07');

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxProvider).toBeLessThanOrEqual(2);
  });
});
