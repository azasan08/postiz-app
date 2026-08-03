import { Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import pLimit from 'p-limit';
import {
  AllChannelsAnalyticsResponse,
  AllChannelsChannelError,
  AllChannelsPerformanceRow,
  AllChannelsTopPost,
  FollowersChannelSeries,
  MetricAvailability,
  MetricCoverage,
  MetricValue,
  PercentageChangeKind,
} from '@gitroom/helpers/interfaces/all.channels.analytics';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { AnalyticsData } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

dayjs.extend(utc);

const ALL_CHANNELS_PROVIDERS = [
  'instagram',
  'instagram-standalone',
  'facebook',
  'x',
] as const;

const SOURCE_METRIC: Record<string, string> = {
  instagram: 'Views',
  'instagram-standalone': 'Views',
  facebook: 'unique media views',
  x: 'Impressions',
};

type PublishedPost = Awaited<
  ReturnType<PostsService['getPublishedPostsForAnalytics']>
>[number];

type PostMetrics = {
  post: PublishedPost;
  reactions: number | null;
  comments: number | null;
  impressions: number | null;
};

type ChannelMetrics = {
  integrationId: string;
  name: string;
  provider: string;
  picture: string | null;
  posts: number;
  reactions: number | null;
  comments: number | null;
  impressions: number | null;
  engRate: number | null;
  followers: number | null;
  previousFollowers: number | null;
  sourceMetric: string | null;
  followersSeries: FollowersChannelSeries;
  postMetrics: PostMetrics[];
  error?: AllChannelsChannelError;
};

@Injectable()
export class AllChannelsAnalyticsService {
  constructor(
    private readonly _integrationService: IntegrationService,
    private readonly _postsService: PostsService
  ) {}

  async getAllChannels(
    org: Organization,
    from: string,
    to: string
  ): Promise<AllChannelsAnalyticsResponse> {
    const cacheKey = `analytics:v2:${org.id}:${from}:${to}`;
    const cached = await ioRedis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const previous = this.previousPeriod(from, to);
    const result = await this.build(org, from, to, previous.from, previous.to);

    await ioRedis.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      !process.env.NODE_ENV || process.env.NODE_ENV === 'development' ? 1 : 3600
    );

    return result;
  }

  previousPeriod(from: string, to: string) {
    const currentFrom = dayjs.utc(from).startOf('day');
    const currentTo = dayjs.utc(to).startOf('day');
    const days = currentTo.diff(currentFrom, 'day') + 1;
    const previousTo = currentFrom.subtract(1, 'day');
    const previousFrom = previousTo.subtract(days - 1, 'day');
    return {
      from: previousFrom.format('YYYY-MM-DD'),
      to: previousTo.format('YYYY-MM-DD'),
    };
  }

  computePercentageChange(
    current: number | null,
    previous: number | null
  ): { percentageChange: number | null; changeKind: PercentageChangeKind } {
    if (current === null || previous === null) {
      return { percentageChange: null, changeKind: 'na' };
    }
    if (previous === 0 && current === 0) {
      return { percentageChange: 0, changeKind: 'percent' };
    }
    if (previous === 0 && current > 0) {
      return { percentageChange: null, changeKind: 'dash' };
    }
    return {
      percentageChange: ((current - previous) / previous) * 100,
      changeKind: 'percent',
    };
  }

  computeEngRate(
    reactions: number | null,
    comments: number | null,
    impressions: number | null
  ): number | null {
    if (
      reactions === null ||
      comments === null ||
      impressions === null ||
      impressions <= 0
    ) {
      return null;
    }
    return ((reactions + comments) / impressions) * 100;
  }

  extractPostMetrics(
    provider: string,
    analytics: AnalyticsData[] | { missing: true } | undefined
  ): {
    reactions: number | null;
    comments: number | null;
    impressions: number | null;
  } {
    if (!analytics || Array.isArray(analytics) === false) {
      return { reactions: null, comments: null, impressions: null };
    }

    const read = (...labels: string[]) => {
      const hit = analytics.find((row) =>
        labels.some((label) => row.label.toLowerCase() === label.toLowerCase())
      );
      if (!hit?.data?.length) {
        return null;
      }
      const total = Number(hit.data[0]?.total);
      return Number.isFinite(total) ? total : null;
    };

    if (provider === 'facebook') {
      return {
        reactions: read('Reactions'),
        comments: null,
        impressions: read('Impressions'),
      };
    }

    if (provider === 'x') {
      return {
        reactions: read('Likes'),
        comments: read('Replies'),
        impressions: read('Impressions'),
      };
    }

    // Instagram / Instagram standalone
    return {
      reactions: read('Likes'),
      comments: read('Comments'),
      impressions: read('Views'),
    };
  }

  rankTopPosts(posts: PostMetrics[], key: 'reactions' | 'comments') {
    return posts
      .filter((p) => p[key] !== null)
      .sort((a, b) => {
        const diff = (b[key] as number) - (a[key] as number);
        if (diff !== 0) {
          return diff;
        }
        return (
          dayjs.utc(b.post.publishDate).valueOf() -
          dayjs.utc(a.post.publishDate).valueOf()
        );
      })
      .slice(0, 5)
      .map((p) => this.toTopPost(p));
  }

  private thumbnailFromImage(image: string | null | undefined): string | null {
    if (!image) {
      return null;
    }
    try {
      const parsed = JSON.parse(image);
      if (Array.isArray(parsed) && parsed[0]) {
        return parsed[0].path || parsed[0].url || null;
      }
      if (parsed?.path || parsed?.url) {
        return parsed.path || parsed.url;
      }
    } catch {
      return null;
    }
    return null;
  }

  private toTopPost(entry: PostMetrics): AllChannelsTopPost {
    return {
      id: entry.post.id,
      content: entry.post.content || '',
      thumbnail: this.thumbnailFromImage(entry.post.image as string | null),
      publishDate: dayjs.utc(entry.post.publishDate).toISOString(),
      releaseURL: entry.post.releaseURL,
      channelId: entry.post.integration?.id || '',
      channelName: entry.post.integration?.name || '',
      provider: entry.post.integration?.providerIdentifier || '',
      picture: entry.post.integration?.picture || null,
      reactions: entry.reactions,
      comments: entry.comments,
      impressions: entry.impressions,
    };
  }

  private coverage(
    availableChannels: number,
    totalChannels: number
  ): MetricCoverage {
    return { availableChannels, totalChannels };
  }

  private buildMetric(
    current: number | null,
    previous: number | null,
    availableChannels: number,
    totalChannels: number,
    availability: MetricAvailability = current === null
      ? 'unavailable'
      : 'available',
    sourceMetric?: string | null
  ): MetricValue {
    const change = this.computePercentageChange(current, previous);
    return {
      value: current,
      previousValue: previous,
      percentageChange: change.percentageChange,
      changeKind: change.changeKind,
      availability,
      coverage: this.coverage(availableChannels, totalChannels),
      sourceMetric: sourceMetric ?? null,
    };
  }

  private createLimiter() {
    const globalLimit = pLimit(3);
    const providerLimits = new Map<string, ReturnType<typeof pLimit>>();
    const getProviderLimit = (provider: string) => {
      if (!providerLimits.has(provider)) {
        providerLimits.set(provider, pLimit(2));
      }
      return providerLimits.get(provider)!;
    };

    return async <T>(provider: string, fn: () => Promise<T>) =>
      globalLimit(() => getProviderLimit(provider)(fn));
  }

  private async build(
    org: Organization,
    from: string,
    to: string,
    previousFrom: string,
    previousTo: string
  ): Promise<AllChannelsAnalyticsResponse> {
    const integrations = (
      await this._integrationService.getIntegrationsList(org.id)
    ).filter(
      (integration) =>
        !integration.disabled &&
        !integration.refreshNeeded &&
        integration.type === 'social' &&
        ALL_CHANNELS_PROVIDERS.includes(
          integration.providerIdentifier as (typeof ALL_CHANNELS_PROVIDERS)[number]
        )
    );

    const limit = this.createLimiter();
    const settled = await Promise.allSettled(
      integrations.map((integration) =>
        this.loadChannel(
          org,
          integration,
          from,
          to,
          previousFrom,
          previousTo,
          limit
        )
      )
    );

    const channels: ChannelMetrics[] = [];
    const errors: AllChannelsChannelError[] = [];

    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        channels.push(result.value);
        if (result.value.error) {
          errors.push(result.value.error);
        }
        return;
      }

      const integration = integrations[index];
      errors.push({
        channelId: integration.id,
        channelName: integration.name,
        provider: integration.providerIdentifier,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : 'Failed to load channel analytics',
      });
    });

    const totalChannels = channels.length || integrations.length;
    const previousChannelMetrics = await Promise.all(
      channels.map(async (channel) => {
        const posts = await this._postsService.getPublishedPostsForAnalytics(
          org.id,
          previousFrom,
          previousTo,
          [channel.integrationId]
        );
        const postMetrics = await this.loadPostMetrics(
          org.id,
          posts,
          channel.provider,
          limit
        );
        return {
          integrationId: channel.integrationId,
          posts: posts.length,
          reactions: this.sumMetric(postMetrics.map((p) => p.reactions)),
          comments: this.sumMetric(postMetrics.map((p) => p.comments)),
          impressions: this.sumMetric(postMetrics.map((p) => p.impressions)),
        };
      })
    );

    const postsCurrent = channels.reduce((sum, c) => sum + c.posts, 0);
    const postsPrevious = previousChannelMetrics.reduce(
      (sum, c) => sum + c.posts,
      0
    );

    const reactionsCurrent = this.sumMetric(channels.map((c) => c.reactions));
    const reactionsPrevious = this.sumMetric(
      previousChannelMetrics.map((c) => c.reactions)
    );
    const commentsCurrent = this.sumMetric(channels.map((c) => c.comments));
    const commentsPrevious = this.sumMetric(
      previousChannelMetrics.map((c) => c.comments)
    );
    const impressionsCurrent = this.sumMetric(
      channels.map((c) => c.impressions)
    );
    const impressionsPrevious = this.sumMetric(
      previousChannelMetrics.map((c) => c.impressions)
    );

    const engEligible = channels.filter(
      (c) =>
        c.reactions !== null && c.comments !== null && c.impressions !== null
    );
    const engEligiblePrev = previousChannelMetrics.filter((c) => {
      const current = channels.find((ch) => ch.integrationId === c.integrationId);
      return (
        !!current &&
        c.reactions !== null &&
        c.comments !== null &&
        c.impressions !== null &&
        current.reactions !== null &&
        current.comments !== null &&
        current.impressions !== null
      );
    });

    const engRateCurrent = this.computeEngRate(
      this.sumMetric(engEligible.map((c) => c.reactions)),
      this.sumMetric(engEligible.map((c) => c.comments)),
      this.sumMetric(engEligible.map((c) => c.impressions))
    );
    const engRatePrevious = this.computeEngRate(
      this.sumMetric(engEligiblePrev.map((c) => c.reactions)),
      this.sumMetric(engEligiblePrev.map((c) => c.comments)),
      this.sumMetric(engEligiblePrev.map((c) => c.impressions))
    );

    const followersCurrentValues = channels.map((c) => c.followers);
    const followersPreviousValues = channels.map((c) => c.previousFollowers);
    const followersAvailable = followersCurrentValues.filter(
      (v) => v !== null
    ) as number[];
    const followersPreviousAvailable = followersPreviousValues.filter(
      (v) => v !== null
    ) as number[];
    const totalFollowersCurrent =
      followersAvailable.length === 0
        ? null
        : followersAvailable.reduce((sum, v) => sum + v, 0);
    const totalFollowersPrevious =
      followersPreviousAvailable.length === channels.length &&
      channels.length > 0
        ? followersPreviousAvailable.reduce((sum, v) => sum + v, 0)
        : null;
    const followersPartial =
      followersAvailable.length > 0 &&
      followersAvailable.length < totalChannels;

    const allPostMetrics = channels.flatMap((c) => c.postMetrics);

    const performance: AllChannelsPerformanceRow[] = channels.map((c) => ({
      channelId: c.integrationId,
      channelName: c.name,
      provider: c.provider,
      picture: c.picture,
      posts: c.posts,
      reactions: c.reactions,
      comments: c.comments,
      impressions: c.impressions,
      engRate: c.engRate,
      followers: c.followers,
      sourceMetric: c.sourceMetric,
    }));

    const followersChannels = channels.map((c) => c.followersSeries);
    const barAvailable = followersChannels.some((c) => c.bar !== null);
    const lineAvailable = followersChannels.some((c) => c.line !== null);
    const growthAvailable = followersChannels.some((c) => c.growth !== null);

    return {
      period: {
        current: { from, to },
        previous: { from: previousFrom, to: previousTo },
      },
      summary: {
        posts: this.buildMetric(
          postsCurrent,
          postsPrevious,
          totalChannels,
          totalChannels,
          'available'
        ),
        reactions: this.buildMetric(
          reactionsCurrent,
          reactionsPrevious,
          channels.filter((c) => c.reactions !== null).length,
          totalChannels
        ),
        comments: this.buildMetric(
          commentsCurrent,
          commentsPrevious,
          channels.filter((c) => c.comments !== null).length,
          totalChannels,
          channels.some((c) => c.comments !== null) ? 'available' : 'unavailable'
        ),
        impressions: this.buildMetric(
          impressionsCurrent,
          impressionsPrevious,
          channels.filter((c) => c.impressions !== null).length,
          totalChannels,
          channels.some((c) => c.impressions !== null)
            ? 'available'
            : 'unavailable',
          'Views/Impressions (provider-specific)'
        ),
        engRate: this.buildMetric(
          engRateCurrent,
          engRatePrevious,
          engEligible.length,
          totalChannels,
          engEligible.length ? 'available' : 'unavailable'
        ),
        totalFollowers: {
          ...this.buildMetric(
            totalFollowersCurrent,
            totalFollowersPrevious,
            followersAvailable.length,
            totalChannels,
            followersAvailable.length ? 'available' : 'unavailable'
          ),
          partial: followersPartial,
        },
      },
      topPosts: {
        byReactions: this.rankTopPosts(allPostMetrics, 'reactions'),
        byComments: this.rankTopPosts(allPostMetrics, 'comments'),
      },
      performance,
      followers: {
        channels: followersChannels,
        availability: {
          bar: barAvailable ? 'available' : 'unavailable',
          line: lineAvailable ? 'available' : 'unavailable',
          growth: growthAvailable ? 'available' : 'unavailable',
        },
      },
      errors,
    };
  }

  private sumMetric(values: Array<number | null>): number | null {
    const available = values.filter((v) => v !== null) as number[];
    if (!available.length) {
      return null;
    }
    return available.reduce((sum, value) => sum + value, 0);
  }

  private async loadChannel(
    org: Organization,
    integration: {
      id: string;
      name: string;
      providerIdentifier: string;
      picture: string | null;
    },
    from: string,
    to: string,
    previousFrom: string,
    previousTo: string,
    limit: <T>(provider: string, fn: () => Promise<T>) => Promise<T>
  ): Promise<ChannelMetrics> {
    const provider = integration.providerIdentifier;
    const sourceMetric = SOURCE_METRIC[provider] || null;

    try {
      const posts = await this._postsService.getPublishedPostsForAnalytics(
        org.id,
        from,
        to,
        [integration.id]
      );

      // Sequential on purpose: checkFollowers refreshes an expired token and
      // persists it before post analytics run, so the same integration never
      // refreshes twice concurrently within one request.
      // ponytail: cross-request refresh races and per-request p-limit (no
      // distributed semaphore) are accepted at current scale (1 replica,
      // 4 channels); add a Redis single-flight lock if replicas/channels grow.
      const followers = await limit(provider, () =>
        this._integrationService.checkFollowers(
          org,
          integration.id,
          previousFrom,
          to
        )
      );
      const postMetrics = await this.loadPostMetrics(
        org.id,
        posts,
        provider,
        limit
      );

      const reactions = this.sumMetric(postMetrics.map((p) => p.reactions));
      const comments =
        provider === 'facebook'
          ? null
          : this.sumMetric(postMetrics.map((p) => p.comments));
      const impressions = this.sumMetric(
        postMetrics.map((p) => p.impressions)
      );

      const line =
        followers.series?.filter(
          (point) => point.date >= from && point.date <= to
        ) || null;
      const growth =
        followers.growth?.filter(
          (point) => point.date >= from && point.date <= to
        ) || null;

      let previousFollowers: number | null = null;
      if (followers.series?.length) {
        const atPreviousEnd = followers.series
          .filter((point) => point.date <= previousTo)
          .at(-1);
        previousFollowers = atPreviousEnd?.value ?? followers.previous;
      }

      return {
        integrationId: integration.id,
        name: integration.name,
        provider,
        picture: integration.picture,
        posts: posts.length,
        reactions,
        comments,
        impressions,
        engRate: this.computeEngRate(reactions, comments, impressions),
        followers: followers.current,
        previousFollowers,
        sourceMetric,
        postMetrics,
        followersSeries: {
          channelId: integration.id,
          channelName: integration.name,
          provider,
          picture: integration.picture,
          current: followers.current,
          bar: followers.current,
          line,
          growth,
          previous: previousFollowers,
        },
      };
    } catch (error) {
      return {
        integrationId: integration.id,
        name: integration.name,
        provider,
        picture: integration.picture,
        posts: 0,
        reactions: null,
        comments: null,
        impressions: null,
        engRate: null,
        followers: null,
        previousFollowers: null,
        sourceMetric,
        postMetrics: [],
        followersSeries: {
          channelId: integration.id,
          channelName: integration.name,
          provider,
          picture: integration.picture,
          current: null,
          bar: null,
          line: null,
          growth: null,
          previous: null,
        },
        error: {
          channelId: integration.id,
          channelName: integration.name,
          provider,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to load channel analytics',
        },
      };
    }
  }

  private async loadPostMetrics(
    orgId: string,
    posts: PublishedPost[],
    provider: string,
    limit: <T>(provider: string, fn: () => Promise<T>) => Promise<T>
  ): Promise<PostMetrics[]> {
    return Promise.all(
      posts.map(async (post) => {
        try {
          const analytics = await limit(provider, () =>
            this._postsService.checkPostAnalytics(orgId, post.id, 30)
          );
          const metrics = this.extractPostMetrics(provider, analytics);
          return {
            post,
            ...metrics,
            comments: provider === 'facebook' ? null : metrics.comments,
          };
        } catch {
          return {
            post,
            reactions: null,
            comments: null,
            impressions: null,
          };
        }
      })
    );
  }
}
