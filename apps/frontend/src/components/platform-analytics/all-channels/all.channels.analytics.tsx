'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { AllChannelsAnalyticsResponse } from '@gitroom/helpers/interfaces/all.channels.analytics';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { AnalyticsDateRange } from './analytics.date.range';
import { AnalyticsSummaryCards } from './analytics.summary.cards';
import { AnalyticsTopPosts } from './analytics.top.posts';
import { AnalyticsPerformanceTable } from './analytics.performance.table';
import { AnalyticsFollowersChart } from './analytics.followers.chart';
import {
  DatePreset,
  isValidCustomRange,
  resolveDateRange,
} from './analytics.utils';

const useAllChannelsAnalytics = (from: string, to: string) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    const response = await fetch(
      `/analytics/all-channels?from=${encodeURIComponent(
        from
      )}&to=${encodeURIComponent(to)}`
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to load all-channels analytics');
    }
    return (await response.json()) as AllChannelsAnalyticsResponse;
  }, [fetch, from, to]);

  return useSWR(
    from && to ? `all-channels-analytics:${from}:${to}` : null,
    load,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );
};

export const AllChannelsAnalytics: FC = () => {
  const [preset, setPreset] = useState<DatePreset>('7');
  const initial = resolveDateRange('7');
  const [customFrom, setCustomFrom] = useState(initial.from);
  const [customTo, setCustomTo] = useState(initial.to);

  const range = useMemo(() => {
    if (preset === 'custom') {
      return resolveDateRange('custom', customFrom, customTo);
    }
    return resolveDateRange(preset);
  }, [preset, customFrom, customTo]);

  const canFetch =
    preset !== 'custom' || isValidCustomRange(range.from, range.to);

  const { data, error, isLoading } = useAllChannelsAnalytics(
    canFetch ? range.from : '',
    canFetch ? range.to : ''
  );

  const handlePresetChange = (next: DatePreset) => {
    if (next !== 'custom') {
      const resolved = resolveDateRange(next);
      setCustomFrom(resolved.from);
      setCustomTo(resolved.to);
    }
    setPreset(next);
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[8px]">
        <h2 className="text-[20px] font-[600]">All Channels</h2>
        <AnalyticsDateRange
          preset={preset}
          from={range.from}
          to={range.to}
          onPresetChange={handlePresetChange}
          onCustomChange={(from, to) => {
            setCustomFrom(from);
            setCustomTo(to);
            setPreset('custom');
          }}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-[48px]">
          <LoadingComponent />
        </div>
      )}

      {!!error && (
        <div className="border border-[#f97066]/40 bg-[#f97066]/10 text-[#e5544d] rounded-[12px] px-[14px] py-[12px] text-[13px]">
          Failed to load All Channels analytics.
        </div>
      )}

      {!!data && (
        <>
          {!!data.errors?.length && (
            <div className="border border-[#d97706]/40 bg-[#d97706]/10 text-[#d97706] rounded-[12px] px-[14px] py-[12px] text-[13px]">
              Partial data: failed to load{' '}
              {data.errors.map((item) => item.channelName).join(', ')}.
            </div>
          )}

          <AnalyticsSummaryCards summary={data.summary} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-[16px]">
            <AnalyticsTopPosts
              byReactions={data.topPosts.byReactions}
              byComments={data.topPosts.byComments}
            />
            <AnalyticsFollowersChart
              channels={data.followers.channels}
              availability={data.followers.availability}
            />
          </div>

          <AnalyticsPerformanceTable rows={data.performance} />
        </>
      )}
    </div>
  );
};
