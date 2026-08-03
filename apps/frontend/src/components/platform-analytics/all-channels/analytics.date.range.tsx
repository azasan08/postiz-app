'use client';

import { FC, useMemo, useState } from 'react';
import { Calendar } from '@mantine/dates';
import { useClickOutside } from '@mantine/hooks';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { DatePreset, isValidCustomRange } from './analytics.utils';

const presets: Array<{ key: DatePreset; label: string }> = [
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: 'mtd', label: 'Month to date' },
  { key: 'custom', label: 'Custom' },
];

export const AnalyticsDateRange: FC<{
  preset: DatePreset;
  from: string;
  to: string;
  onPresetChange: (preset: DatePreset) => void;
  onCustomChange: (from: string, to: string) => void;
}> = ({ preset, from, to, onPresetChange, onCustomChange }) => {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const valid = useMemo(
    () => isValidCustomRange(draftFrom, draftTo),
    [draftFrom, draftTo]
  );

  return (
    <div className="flex flex-wrap items-center gap-[8px] relative">
      {presets.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            onPresetChange(item.key);
            if (item.key === 'custom') {
              setDraftFrom(from);
              setDraftTo(to);
              setOpen(true);
            } else {
              setOpen(false);
            }
          }}
          className={clsx(
            'h-[36px] px-[12px] rounded-[8px] text-[13px] font-[500] border transition-colors',
            preset === item.key
              ? 'bg-btnPrimary text-white border-btnPrimary'
              : 'bg-newBgColorInner border-newTableBorder text-newTableText hover:bg-boxHover'
          )}
        >
          {item.label}
        </button>
      ))}

      {preset === 'custom' && (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="h-[36px] px-[12px] rounded-[8px] text-[13px] border border-newTableBorder bg-newTableHeader text-textColor"
        >
          {from} → {to}
        </button>
      )}

      {open && preset === 'custom' && (
        <div
          ref={ref}
          className="absolute top-[44px] start-0 z-[40] bg-newBgColorInner border border-newTableBorder rounded-[12px] p-[16px] shadow-lg flex flex-col gap-[12px]"
        >
          <div className="flex flex-col md:flex-row gap-[16px]">
            <div>
              <div className="text-[12px] text-newTableText mb-[8px]">From</div>
              <Calendar
                value={dayjs(draftFrom).toDate()}
                onChange={(value) =>
                  setDraftFrom(dayjs(value).format('YYYY-MM-DD'))
                }
              />
            </div>
            <div>
              <div className="text-[12px] text-newTableText mb-[8px]">To</div>
              <Calendar
                value={dayjs(draftTo).toDate()}
                onChange={(value) =>
                  setDraftTo(dayjs(value).format('YYYY-MM-DD'))
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-[12px]">
            <div className="text-[12px] text-newTableText">
              Max 100 days inclusive
            </div>
            <button
              type="button"
              disabled={!valid}
              onClick={() => {
                onCustomChange(draftFrom, draftTo);
                setOpen(false);
              }}
              className={clsx(
                'h-[36px] px-[14px] rounded-[8px] text-[13px] font-[500]',
                valid
                  ? 'bg-btnPrimary text-white'
                  : 'bg-btnSimple text-newTableText opacity-60 cursor-not-allowed'
              )}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
