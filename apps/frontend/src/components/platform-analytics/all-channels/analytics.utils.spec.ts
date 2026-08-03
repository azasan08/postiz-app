import {
  computePercentageChange,
  excerpt,
  inclusiveDays,
  isValidCustomRange,
  previousPeriod,
  resolveDateRange,
  sortPerformanceRows,
} from './analytics.utils';
import { AllChannelsPerformanceRow } from '@gitroom/helpers/interfaces/all.channels.analytics';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

describe('analytics.utils', () => {
  const today = dayjs.utc('2026-08-03');

  it('resolves 7 days, 30 days, month to date, and custom ranges', () => {
    expect(resolveDateRange('7', undefined, undefined, today)).toEqual({
      from: '2026-07-28',
      to: '2026-08-03',
    });
    expect(resolveDateRange('30', undefined, undefined, today)).toEqual({
      from: '2026-07-05',
      to: '2026-08-03',
    });
    expect(resolveDateRange('mtd', undefined, undefined, today)).toEqual({
      from: '2026-08-01',
      to: '2026-08-03',
    });
    expect(
      resolveDateRange('custom', '2026-07-01', '2026-07-07', today)
    ).toEqual({
      from: '2026-07-01',
      to: '2026-07-07',
    });
  });

  it('computes the previous equal-length period boundaries', () => {
    expect(previousPeriod('2026-07-01', '2026-07-07')).toEqual({
      from: '2026-06-24',
      to: '2026-06-30',
    });
    expect(inclusiveDays('2026-07-01', '2026-07-07')).toBe(7);
  });

  it('allows custom 100 days and rejects 101 days', () => {
    expect(isValidCustomRange('2026-01-01', '2026-04-10')).toBe(true);
    expect(inclusiveDays('2026-01-01', '2026-04-10')).toBe(100);
    expect(isValidCustomRange('2026-01-01', '2026-04-11')).toBe(false);
    expect(inclusiveDays('2026-01-01', '2026-04-11')).toBe(101);
  });

  it('handles zero-baseline percentage changes without inventing infinity', () => {
    expect(computePercentageChange(0, 0)).toEqual({
      percentageChange: 0,
      changeKind: 'percent',
    });
    expect(computePercentageChange(5, 0)).toEqual({
      percentageChange: null,
      changeKind: 'dash',
    });
    expect(computePercentageChange(null, 0)).toEqual({
      percentageChange: null,
      changeKind: 'na',
    });
    expect(computePercentageChange(10, 5)).toEqual({
      percentageChange: 100,
      changeKind: 'percent',
    });
  });

  it('keeps null sortable values behind real numbers', () => {
    const rows: AllChannelsPerformanceRow[] = [
      {
        channelId: '1',
        channelName: 'A',
        provider: 'instagram',
        picture: null,
        posts: 1,
        reactions: null,
        comments: 2,
        impressions: 10,
        engRate: null,
        followers: 100,
        sourceMetric: 'Views',
      },
      {
        channelId: '2',
        channelName: 'B',
        provider: 'x',
        picture: null,
        posts: 2,
        reactions: 5,
        comments: null,
        impressions: 20,
        engRate: 1,
        followers: null,
        sourceMetric: 'Impressions',
      },
    ];

    expect(sortPerformanceRows(rows, 'reactions', 'desc')[0].channelId).toBe(
      '2'
    );
    expect(sortPerformanceRows(rows, 'followers', 'desc')[0].channelId).toBe(
      '1'
    );
  });

  it('excerpts content without turning missing text into fabricated values', () => {
    expect(excerpt('')).toBe('');
    expect(excerpt('hello world')).toBe('hello world');
  });
});
