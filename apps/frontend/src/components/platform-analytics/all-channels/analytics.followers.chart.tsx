'use client';

import { FC, useEffect, useMemo, useRef, useState } from 'react';
import DrawChart from 'chart.js/auto';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import {
  FollowersChannelSeries,
  MetricAvailability,
} from '@gitroom/helpers/interfaces/all.channels.analytics';

type Mode = 'bar' | 'line' | 'growth';

const COLORS = ['#612bd3', '#1d9bf0', '#e5484d', '#0d9488', '#d97706', '#7c3aed'];

export const AnalyticsFollowersChart: FC<{
  channels: FollowersChannelSeries[];
  availability: {
    bar: MetricAvailability;
    line: MetricAvailability;
    growth: MetricAvailability;
  };
}> = ({ channels, availability }) => {
  const [mode, setMode] = useState<Mode>('bar');
  const [cookieMode] = useCookie('mode', 'dark');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<DrawChart | null>(null);

  const modeAvailability = availability[mode];
  const usableChannels = useMemo(() => {
    return channels.filter((channel) => {
      if (mode === 'bar') {
        return channel.bar !== null;
      }
      if (mode === 'line') {
        return !!channel.line?.length;
      }
      return !!channel.growth?.length;
    });
  }, [channels, mode]);

  useEffect(() => {
    if (!canvasRef.current || modeAvailability !== 'available' || !usableChannels.length) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();

    if (mode === 'bar') {
      chartRef.current = new DrawChart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: usableChannels.map((c) => c.channelName),
          datasets: [
            {
              label: 'Followers',
              data: usableChannels.map((c) => c.bar as number),
              backgroundColor: usableChannels.map(
                (_, index) => COLORS[index % COLORS.length]
              ),
              borderRadius: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              ticks: {
                color: cookieMode === 'dark' ? '#9c9c9c' : '#777b7f',
              },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              ticks: {
                color: cookieMode === 'dark' ? '#9c9c9c' : '#777b7f',
              },
              grid: {
                color:
                  cookieMode === 'dark'
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.06)',
              },
            },
          },
        },
      });
      return () => {
        chartRef.current?.destroy();
        chartRef.current = null;
      };
    }

    const labels =
      usableChannels[0]?.[mode === 'line' ? 'line' : 'growth']?.map(
        (point) => point.date
      ) || [];

    chartRef.current = new DrawChart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: usableChannels.map((channel, index) => ({
          label: channel.channelName,
          data: (mode === 'line' ? channel.line : channel.growth)?.map(
            (point) => point.value
          ),
          borderColor: COLORS[index % COLORS.length],
          backgroundColor: COLORS[index % COLORS.length],
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: cookieMode === 'dark' ? '#9c9c9c' : '#777b7f',
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: cookieMode === 'dark' ? '#9c9c9c' : '#777b7f',
              maxTicksLimit: 7,
            },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: cookieMode === 'dark' ? '#9c9c9c' : '#777b7f',
            },
            grid: {
              color:
                cookieMode === 'dark'
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.06)',
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [mode, usableChannels, modeAvailability, cookieMode]);

  return (
    <div className="bg-newTableHeader border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <h3 className="text-[16px] font-[600]">Followers</h3>
        <div className="flex gap-[6px]">
          {([
            ['bar', 'Bar'],
            ['line', 'Line'],
            ['growth', 'Growth'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={clsx(
                'h-[32px] px-[10px] rounded-[8px] text-[12px] font-[500] border',
                mode === key
                  ? 'bg-btnPrimary text-white border-btnPrimary'
                  : 'border-newTableBorder text-newTableText'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {modeAvailability !== 'available' || !usableChannels.length ? (
        <div className="h-[240px] grid place-items-center text-[13px] text-newTableText">
          N/A — follower history is unavailable for this view
        </div>
      ) : (
        <div className="h-[240px]">
          <canvas ref={canvasRef} />
        </div>
      )}
    </div>
  );
};
