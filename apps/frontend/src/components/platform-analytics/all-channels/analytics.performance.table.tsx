'use client';

import { FC, useMemo, useState } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { AllChannelsPerformanceRow } from '@gitroom/helpers/interfaces/all.channels.analytics';
import {
  formatMetricNumber,
  formatPercent,
  PerformanceSortKey,
  sortPerformanceRows,
} from './analytics.utils';

const columns: Array<{ key: PerformanceSortKey; label: string }> = [
  { key: 'channelName', label: 'Channel' },
  { key: 'posts', label: 'Posts' },
  { key: 'reactions', label: 'Reactions' },
  { key: 'comments', label: 'Comments' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'engRate', label: 'Eng. Rate' },
  { key: 'followers', label: 'Followers' },
];

export const AnalyticsPerformanceTable: FC<{
  rows: AllChannelsPerformanceRow[];
}> = ({ rows }) => {
  const [sortKey, setSortKey] = useState<PerformanceSortKey>('reactions');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(
    () => sortPerformanceRows(rows, sortKey, direction),
    [rows, sortKey, direction]
  );

  const toggleSort = (key: PerformanceSortKey) => {
    if (sortKey === key) {
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setDirection(key === 'channelName' ? 'asc' : 'desc');
  };

  return (
    <div className="bg-newTableHeader border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[12px]">
      <h3 className="text-[16px] font-[600]">Channel Performance</h3>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-[13px]">
          <thead>
            <tr className="border-b border-newTableBorder text-newTableText">
              {columns.map((column) => (
                <th key={column.key} className="text-start font-[500] py-[10px]">
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="inline-flex items-center gap-[4px]"
                  >
                    {column.label}
                    <span className="text-[10px] opacity-70">
                      {sortKey === column.key
                        ? direction === 'asc'
                          ? '▲'
                          : '▼'
                        : ''}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.channelId}
                className="border-b border-newTableBorder/60 last:border-b-0"
              >
                <td className="py-[12px]">
                  <div className="flex items-center gap-[8px]">
                    <ImageWithFallback
                      fallbackSrc={`/icons/platforms/${row.provider}.png`}
                      src={row.picture || `/icons/platforms/${row.provider}.png`}
                      alt={row.channelName}
                      width={22}
                      height={22}
                      className="rounded-[6px]"
                    />
                    <span>{row.channelName}</span>
                  </div>
                </td>
                <td className="py-[12px] tabular-nums">
                  {formatMetricNumber(row.posts)}
                </td>
                <td className="py-[12px] tabular-nums">
                  {formatMetricNumber(row.reactions)}
                </td>
                <td className="py-[12px] tabular-nums">
                  {formatMetricNumber(row.comments)}
                </td>
                <td
                  className="py-[12px] tabular-nums"
                  title={row.sourceMetric || undefined}
                >
                  {formatMetricNumber(row.impressions)}
                </td>
                <td className="py-[12px] tabular-nums">
                  {formatPercent(row.engRate)}
                </td>
                <td className="py-[12px] tabular-nums">
                  {formatMetricNumber(row.followers)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sorted.length && (
          <div className={clsx('text-[13px] text-newTableText py-[16px]')}>
            No channel performance data.
          </div>
        )}
      </div>
    </div>
  );
};
