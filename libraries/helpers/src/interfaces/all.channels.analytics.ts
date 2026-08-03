export type MetricAvailability = 'available' | 'unavailable' | 'error';

export type PercentageChangeKind = 'percent' | 'dash' | 'na';

export interface MetricCoverage {
  availableChannels: number;
  totalChannels: number;
}

export interface MetricValue {
  value: number | null;
  previousValue: number | null;
  /** Absolute percentage when kind is `percent`; otherwise null. */
  percentageChange: number | null;
  changeKind: PercentageChangeKind;
  availability: MetricAvailability;
  coverage: MetricCoverage;
  /** Provider-native metric name for impressions explanations. */
  sourceMetric?: string | null;
}

export interface AllChannelsPeriod {
  from: string;
  to: string;
}

export interface AllChannelsChannelError {
  channelId: string;
  channelName: string;
  provider: string;
  message: string;
}

export interface AllChannelsTopPost {
  id: string;
  content: string;
  thumbnail: string | null;
  publishDate: string;
  releaseURL: string | null;
  channelId: string;
  channelName: string;
  provider: string;
  picture: string | null;
  reactions: number | null;
  comments: number | null;
  impressions: number | null;
}

export interface AllChannelsPerformanceRow {
  channelId: string;
  channelName: string;
  provider: string;
  picture: string | null;
  posts: number;
  reactions: number | null;
  comments: number | null;
  impressions: number | null;
  engRate: number | null;
  followers: number | null;
  sourceMetric: string | null;
}

export interface FollowersPoint {
  date: string;
  value: number;
}

export interface FollowersChannelSeries {
  channelId: string;
  channelName: string;
  provider: string;
  picture: string | null;
  current: number | null;
  /** Current total for bar chart; null when unavailable. */
  bar: number | null;
  /** Daily reconstructed totals; null when history cannot be rebuilt. */
  line: FollowersPoint[] | null;
  /** Daily net growth; null when unavailable. */
  growth: FollowersPoint[] | null;
  previous: number | null;
}

export interface AllChannelsAnalyticsResponse {
  period: {
    current: AllChannelsPeriod;
    previous: AllChannelsPeriod;
  };
  summary: {
    posts: MetricValue;
    reactions: MetricValue;
    comments: MetricValue;
    impressions: MetricValue;
    engRate: MetricValue;
    totalFollowers: MetricValue & { partial: boolean };
  };
  topPosts: {
    byReactions: AllChannelsTopPost[];
    byComments: AllChannelsTopPost[];
  };
  performance: AllChannelsPerformanceRow[];
  followers: {
    channels: FollowersChannelSeries[];
    availability: {
      bar: MetricAvailability;
      line: MetricAvailability;
      growth: MetricAvailability;
    };
  };
  errors: AllChannelsChannelError[];
}

export interface FollowersAnalyticsResult {
  current: number | null;
  /** End-of-day follower totals within the range; null when unreproducible. */
  series: FollowersPoint[] | null;
  /** Daily net change; null when unreproducible. */
  growth: FollowersPoint[] | null;
  /** Follower count at the end of the range when series exists. */
  previous: number | null;
}
