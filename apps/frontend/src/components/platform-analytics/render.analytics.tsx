import {
  FC,
  ReactElement,
  useCallback,
  useMemo,
  useState,
  useId,
} from 'react';
import { Integration } from '@prisma/client';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

interface AnalyticsDataItem {
  label: string;
  data: Array<{ total: number; date: string }>;
  average?: boolean;
  percentageChange?: number;
}

const ACCENT = '#612bd3';

// Per-metric identity: color + icon, matched on the (english) label the
// backends emit. Fallback is the brand accent with a generic chart icon.
interface MetricStyle {
  color: string;
  icon: ReactElement;
}

const icon = (paths: ReactElement) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {paths}
  </svg>
);

const METRIC_STYLES: Array<{ match: RegExp } & MetricStyle> = [
  {
    match: /reach|impression/i,
    color: '#612bd3',
    icon: icon(
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  {
    match: /follower|subscriber|member|fans?/i,
    color: '#2563eb',
    icon: icon(
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    match: /like|favorite|reaction/i,
    color: '#e5484d',
    icon: icon(
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    ),
  },
  {
    match: /view|watch/i,
    color: '#0d9488',
    icon: icon(
      <>
        <polygon points="10 8 16 12 10 16 10 8" />
        <circle cx="12" cy="12" r="10" />
      </>
    ),
  },
  {
    match: /comment|repl/i,
    color: '#d97706',
    icon: icon(
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 21l1.9-5a8.4 8.4 0 0 1-.9-4 8.4 8.4 0 0 1 8.4-8.4A8.4 8.4 0 0 1 21 11.5z" />
    ),
  },
  {
    match: /share|repost|retweet/i,
    color: '#7c3aed',
    icon: icon(
      <>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <path d="M16 6l-4-4-4 4M12 2v13" />
      </>
    ),
  },
  {
    match: /save|bookmark/i,
    color: '#db2777',
    icon: icon(
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    ),
  },
  {
    match: /click|engagement/i,
    color: '#0284c7',
    icon: icon(
      <>
        <path d="M9 9l5 12 1.8-5.2L21 14z" />
        <path d="M7.2 2.2L8 5.1M5.1 8l-2.9-.8M14 4.1L12 6M6 12l-1.9 2" />
      </>
    ),
  },
];

const metricStyle = (label: string): MetricStyle => {
  const found = METRIC_STYLES.find((m) => m.match.test(label));
  if (found) {
    return { color: found.color, icon: found.icon };
  }
  return {
    color: ACCENT,
    icon: icon(<path d="M3 3v18h18M7 15l4-4 3 3 5-6" />),
  };
};

// A metric only has a drawable history when the provider returns real daily
// values. Single total_value points (Instagram engagement metrics) and the
// fabricated 0->total pairs (X) are not a series.
const hasSeries = (item: AnalyticsDataItem) => item.data.length >= 3;

// In-window trend: second half of the period vs the first half. The backends
// hardcode percentageChange, so it is ignored entirely.
// ponytail: spiky low-volume data produces meaningless huge percentages, so
// anything beyond +-300% is treated as "no comparable baseline" and hidden.
const seriesTrend = (item: AnalyticsDataItem): number | null => {
  if (!hasSeries(item)) {
    return null;
  }
  const half = Math.floor(item.data.length / 2);
  const first = item.data
    .slice(0, half)
    .reduce((acc, curr) => acc + curr.total, 0);
  const second = item.data
    .slice(item.data.length - half)
    .reduce((acc, curr) => acc + curr.total, 0);
  if (first === 0) {
    return null;
  }
  const trend = ((second - first) / first) * 100;
  if (Math.abs(trend) > 300) {
    return null;
  }
  return trend;
};

const rawTotal = (item: AnalyticsDataItem) => {
  const sum = item.data.reduce((acc, curr) => acc + curr.total, 0);
  return sum / (item.average ? item.data.length || 1 : 1);
};

const formatTotal = (item: AnalyticsDataItem) => {
  const value = rawTotal(item);
  if (item.average) {
    return value.toFixed(2) + '%';
  }
  return new Intl.NumberFormat().format(Math.round(value));
};

const Chip: FC<{ style: MetricStyle; size: 'lg' | 'sm' }> = ({
  style,
  size,
}) => (
  <span
    className={`grid place-items-center rounded-[10px] flex-none ${
      size === 'lg' ? 'w-[34px] h-[34px]' : 'w-[28px] h-[28px] scale-90'
    }`}
    style={{ backgroundColor: style.color + '1f', color: style.color }}
  >
    {style.icon}
  </span>
);

const TrendIndicator: FC<{ value: number }> = ({ value }) => {
  if (Math.abs(value) < 0.05) {
    return null;
  }
  const isPositive = value > 0;
  return (
    <div
      className={`flex items-center gap-[3px] text-[12px] font-semibold rounded-full px-[9px] py-[4px] ${
        isPositive
          ? 'text-[#1fa971] bg-[#32d583]/10'
          : 'text-[#e5544d] bg-[#f97066]/10'
      }`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isPositive ? (
          <path d="M7 17L17 7M17 7H9M17 7v8" />
        ) : (
          <path d="M7 7l10 10M17 17H9M17 17V9" />
        )}
      </svg>
      <span className="tabular-nums">{Math.abs(value).toFixed(0)}%</span>
    </div>
  );
};

// Catmull-Rom -> cubic bezier so the line reads as a curve, not a seismograph.
const smoothPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length < 2) {
    return '';
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(
      2
    )} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
};

const Sparkline: FC<{
  data: Array<{ total: number }>;
  height: number;
  color: string;
  area?: boolean;
}> = ({ data, height, color, area }) => {
  const gradientId = useId();
  const width = 400;
  const padY = area ? 10 : 5;
  const values = data.map((d) => d.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: padY + (1 - (v - min) / range) * (height - padY * 2),
  }));
  const path = smoothPath(points);
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="block"
      aria-hidden="true"
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.28" />
              <stop offset="1" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <path
            d={`${path} L ${width} ${height} L 0 ${height} Z`}
            fill={`url(#${gradientId})`}
          />
        </>
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeOpacity={area ? 1 : 0.9}
        strokeWidth={area ? 2.5 : 1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {area && (
        <>
          <circle cx={last.x} cy={last.y} r="7" fill={color} fillOpacity="0.14" />
          <circle cx={last.x} cy={last.y} r="3.5" fill={color} />
        </>
      )}
    </svg>
  );
};

const HeroCard: FC<{ item: AnalyticsDataItem }> = ({ item }) => {
  const trend = seriesTrend(item);
  const value = rawTotal(item);
  const style = metricStyle(item.label);
  const first = item.data[0]?.date;
  const last = item.data[item.data.length - 1]?.date;
  return (
    <div className="flex flex-col bg-newTableHeader border border-newTableBorder rounded-[16px] overflow-hidden transition-all hover:border-newTableBorder hover:shadow-[0_10px_30px_rgba(97,43,211,0.10)]">
      <div className="flex items-start justify-between px-[22px] pt-[20px]">
        <div className="flex items-center gap-[9px]">
          <Chip style={style} size="lg" />
          <span className="text-[12px] font-semibold tracking-[0.06em] uppercase text-newTableText">
            {item.label}
          </span>
        </div>
        {trend !== null && <TrendIndicator value={trend} />}
      </div>
      <div
        className={`mt-[12px] px-[22px] text-[40px] leading-[42px] font-semibold tracking-tight tabular-nums ${
          value < 0 ? 'text-[#f97066]' : ''
        }`}
      >
        {formatTotal(item)}
      </div>
      <div className="mt-[14px]">
        <Sparkline data={item.data} height={88} color={style.color} area={true} />
      </div>
      {first && last && (
        <div className="flex justify-between px-[22px] pt-[6px] pb-[16px] text-[11px] text-newTableText opacity-70 tabular-nums">
          <span>{first}</span>
          <span>{last}</span>
        </div>
      )}
    </div>
  );
};

const MiniCard: FC<{ item: AnalyticsDataItem }> = ({ item }) => {
  const trend = seriesTrend(item);
  const value = rawTotal(item);
  const style = metricStyle(item.label);
  return (
    <div className="flex flex-col gap-[10px] bg-newTableHeader border border-newTableBorder rounded-[16px] px-[16px] pt-[16px] pb-[12px] transition-all hover:shadow-[0_10px_30px_rgba(97,43,211,0.10)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <Chip style={style} size="sm" />
          <span className="text-[12px] font-semibold tracking-[0.04em] uppercase text-newTableText">
            {item.label}
          </span>
        </div>
        {trend !== null && <TrendIndicator value={trend} />}
      </div>
      <div
        className={`text-[26px] leading-[28px] font-semibold tracking-tight tabular-nums ${
          value < 0 ? 'text-[#f97066]' : ''
        }`}
      >
        {formatTotal(item)}
      </div>
      {hasSeries(item) && (
        <div className="-mx-[4px] -mb-[2px]">
          <Sparkline data={item.data} height={30} color={style.color} />
        </div>
      )}
    </div>
  );
};

const EmptyState: FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const t = useT();

  return (
    <div className="flex flex-col items-center justify-center py-[48px] px-[24px] bg-newTableHeader border border-newTableBorder rounded-[12px]">
      <div className="w-[48px] h-[48px] mb-[16px] rounded-full bg-[#612bd3]/10 flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-[#612bd3]"
        >
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path d="M12 8v4l2 2" />
        </svg>
      </div>
      <p className="text-[15px] text-newTableText text-center mb-[12px]">
        {t(
          'this_channel_needs_to_be_refreshed',
          'This channel needs to be refreshed to display analytics'
        )}
      </p>
      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-[6px] px-[16px] py-[8px] text-[14px] font-medium text-white bg-[#612bd3] hover:bg-[#5023b8] rounded-[8px] transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M23 4v6h-6M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
        {t('refresh_channel', 'Refresh Channel')}
      </button>
    </div>
  );
};

export const RenderAnalytics: FC<{
  integration: Integration;
  date: number;
}> = (props) => {
  const { integration, date } = props;
  const [loading, setLoading] = useState(true);
  const fetch = useFetch();

  const load = useCallback(async () => {
    setLoading(true);
    const load = (
      await fetch(`/analytics/${integration.id}?date=${date}`)
    ).json();
    setLoading(false);
    return load;
  }, [integration, date]);

  const { data } = useSWR(`/analytics-${integration?.id}-${date}`, load, {
    refreshInterval: 0,
    refreshWhenHidden: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    revalidateOnMount: true,
  });

  const refreshChannel = useCallback(
    (
        integrationData: Integration & {
          identifier: string;
        }
      ) =>
      async () => {
        const { url } = await (
          await fetch(
            `/integrations/social/${integrationData.identifier}?refresh=${integrationData.internalId}`,
            {
              method: 'GET',
            }
          )
        ).json();
        window.location.href = url;
      },
    []
  );

  const t = useT();

  const groups = useMemo(() => {
    const items: AnalyticsDataItem[] = data || [];
    const zeros = items.filter((p) => !p.average && rawTotal(p) === 0);
    const active = items.filter((p) => !zeros.includes(p));
    // Heroes: the two biggest metrics that have a real history to chart.
    const heroes = [...active]
      .filter(hasSeries)
      .sort((a, b) => Math.abs(rawTotal(b)) - Math.abs(rawTotal(a)))
      .slice(0, 2);
    const minis = active.filter((p) => !heroes.includes(p));
    return { heroes, minis, zeros };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-[48px]">
        <LoadingComponent />
      </div>
    );
  }

  if (!data?.length) {
    return <EmptyState onRefresh={refreshChannel(integration as any)} />;
  }

  return (
    <div className="flex flex-col gap-[16px]">
      {!!groups.heroes.length && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
          {groups.heroes.map((item) => (
            <HeroCard key={item.label} item={item} />
          ))}
        </div>
      )}
      {!!groups.minis.length && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[16px]">
          {groups.minis.map((item) => (
            <MiniCard key={item.label} item={item} />
          ))}
        </div>
      )}
      {!!groups.zeros.length && (
        <div className="flex flex-wrap items-center gap-x-[20px] gap-y-[8px] border border-dashed border-newTableBorder rounded-[12px] px-[16px] py-[12px] text-[13px]">
          <span className="text-newTableText">
            {t('no_activity_this_period', 'No activity this period:')}
          </span>
          {groups.zeros.map((item) => (
            <span key={item.label} className="text-newTableText">
              {item.label} <b className="font-semibold tabular-nums">0</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
