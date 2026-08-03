import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {
  AllChannelsPerformanceRow,
  MetricValue,
  PercentageChangeKind,
} from '@gitroom/helpers/interfaces/all.channels.analytics';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

export type DatePreset = '7' | '30' | 'mtd' | 'custom';

export function resolveDateRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
  today = dayjs.utc()
): { from: string; to: string } {
  const end = today.startOf('day');
  if (preset === '7') {
    return {
      from: end.subtract(6, 'day').format('YYYY-MM-DD'),
      to: end.format('YYYY-MM-DD'),
    };
  }
  if (preset === '30') {
    return {
      from: end.subtract(29, 'day').format('YYYY-MM-DD'),
      to: end.format('YYYY-MM-DD'),
    };
  }
  if (preset === 'mtd') {
    return {
      from: end.startOf('month').format('YYYY-MM-DD'),
      to: end.format('YYYY-MM-DD'),
    };
  }

  const from = dayjs.utc(customFrom || end.format('YYYY-MM-DD')).startOf('day');
  const to = dayjs.utc(customTo || end.format('YYYY-MM-DD')).startOf('day');
  return {
    from: from.format('YYYY-MM-DD'),
    to: to.format('YYYY-MM-DD'),
  };
}

export function previousPeriod(from: string, to: string) {
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

export function inclusiveDays(from: string, to: string) {
  return (
    dayjs.utc(to).startOf('day').diff(dayjs.utc(from).startOf('day'), 'day') + 1
  );
}

export function isValidCustomRange(from: string, to: string) {
  if (!from || !to) {
    return false;
  }
  const start = dayjs.utc(from, 'YYYY-MM-DD', true).startOf('day');
  const end = dayjs.utc(to, 'YYYY-MM-DD', true).startOf('day');
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    return false;
  }
  return inclusiveDays(from, to) <= 100;
}

export function computePercentageChange(
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

export function formatMetricNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return new Intl.NumberFormat().format(Math.round(value));
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return `${value.toFixed(2)}%`;
}

export function formatChange(metric: Pick<
  MetricValue,
  'percentageChange' | 'changeKind'
>): string {
  if (metric.changeKind === 'dash') {
    return '—';
  }
  if (metric.changeKind === 'na' || metric.percentageChange === null) {
    return 'N/A';
  }
  const rounded = Math.abs(metric.percentageChange).toFixed(0);
  const sign = metric.percentageChange > 0 ? '+' : metric.percentageChange < 0 ? '−' : '';
  return `${sign}${rounded}%`;
}

export function changeTone(
  metric: Pick<MetricValue, 'percentageChange' | 'changeKind'>
): 'up' | 'down' | 'neutral' {
  if (
    metric.changeKind !== 'percent' ||
    metric.percentageChange === null ||
    Math.abs(metric.percentageChange) < 0.05
  ) {
    return 'neutral';
  }
  return metric.percentageChange > 0 ? 'up' : 'down';
}

export type PerformanceSortKey = keyof Pick<
  AllChannelsPerformanceRow,
  | 'channelName'
  | 'posts'
  | 'reactions'
  | 'comments'
  | 'impressions'
  | 'engRate'
  | 'followers'
>;

export function sortPerformanceRows(
  rows: AllChannelsPerformanceRow[],
  key: PerformanceSortKey,
  direction: 'asc' | 'desc'
) {
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];

    if (av === null || av === undefined) {
      return 1;
    }
    if (bv === null || bv === undefined) {
      return -1;
    }

    const compared =
      typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv)
        : Number(av) - Number(bv);

    return direction === 'asc' ? compared : -compared;
  });
}

export function excerpt(content: string, max = 100) {
  const text = (content || '').replace(/<[^>]+>/g, '').trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max).trim()}…`;
}
