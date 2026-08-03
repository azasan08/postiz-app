'use client';

import { FC } from 'react';
import clsx from 'clsx';
import { MetricValue } from '@gitroom/helpers/interfaces/all.channels.analytics';
import {
  changeTone,
  formatChange,
  formatMetricNumber,
  formatPercent,
} from './analytics.utils';

const cards: Array<{
  key: string;
  label: string;
  hint?: string;
}> = [
  { key: 'posts', label: 'Posts' },
  { key: 'reactions', label: 'Reactions' },
  { key: 'comments', label: 'Comments' },
  {
    key: 'impressions',
    label: 'Impressions',
    hint: 'Includes provider Views / unique media views where applicable',
  },
  { key: 'engRate', label: 'Eng. Rate' },
  { key: 'totalFollowers', label: 'Total Followers' },
];

export const AnalyticsSummaryCards: FC<{
  summary: {
    posts: MetricValue;
    reactions: MetricValue;
    comments: MetricValue;
    impressions: MetricValue;
    engRate: MetricValue;
    totalFollowers: MetricValue & { partial: boolean };
  };
}> = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[12px]">
      {cards.map((card) => {
        const metric =
          summary[card.key as keyof typeof summary] as MetricValue & {
            partial?: boolean;
          };
        const tone = changeTone(metric);
        const isRate = card.key === 'engRate';
        return (
          <div
            key={card.key}
            className="bg-newTableHeader border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[10px]"
            title={card.hint || metric.sourceMetric || undefined}
          >
            <div className="flex items-start justify-between gap-[8px]">
              <div className="text-[12px] uppercase tracking-[0.04em] text-newTableText font-[600]">
                {card.label}
              </div>
              <div
                className={clsx(
                  'text-[12px] font-[600] px-[8px] py-[3px] rounded-full',
                  tone === 'up' && 'text-[#1fa971] bg-[#32d583]/10',
                  tone === 'down' && 'text-[#e5544d] bg-[#f97066]/10',
                  tone === 'neutral' && 'text-newTableText bg-btnSimple'
                )}
              >
                {formatChange(metric)}
              </div>
            </div>
            <div className="text-[28px] leading-[32px] font-[600] tabular-nums">
              {metric.value === null
                ? 'N/A'
                : isRate
                ? formatPercent(metric.value)
                : formatMetricNumber(metric.value)}
            </div>
            <div className="text-[12px] text-newTableText">
              {metric.coverage.availableChannels}/{metric.coverage.totalChannels}{' '}
              channels
              {card.key === 'totalFollowers' && metric.partial
                ? ' · partial coverage'
                : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
};
