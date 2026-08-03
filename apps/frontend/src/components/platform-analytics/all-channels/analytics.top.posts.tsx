'use client';

import { FC, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { AllChannelsTopPost } from '@gitroom/helpers/interfaces/all.channels.analytics';
import { excerpt, formatMetricNumber } from './analytics.utils';

export const AnalyticsTopPosts: FC<{
  byReactions: AllChannelsTopPost[];
  byComments: AllChannelsTopPost[];
}> = ({ byReactions, byComments }) => {
  const [mode, setMode] = useState<'reactions' | 'comments'>('reactions');
  const posts = useMemo(
    () => (mode === 'reactions' ? byReactions : byComments),
    [mode, byReactions, byComments]
  );

  return (
    <div className="bg-newTableHeader border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <h3 className="text-[16px] font-[600]">Top Posts</h3>
        <div className="flex gap-[6px]">
          {(['reactions', 'comments'] as const).map((key) => (
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
              {key === 'reactions' ? 'Reactions' : 'Comments'}
            </button>
          ))}
        </div>
      </div>

      {!posts.length ? (
        <div className="text-[13px] text-newTableText py-[20px]">
          No ranked posts for this metric in the selected period.
        </div>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {posts.map((post) => (
            <a
              key={post.id}
              href={post.releaseURL || undefined}
              target={post.releaseURL ? '_blank' : undefined}
              rel="noreferrer"
              className={clsx(
                'flex gap-[12px] items-start p-[10px] rounded-[10px] border border-newTableBorder bg-newBgColorInner',
                post.releaseURL && 'hover:bg-boxHover'
              )}
            >
              <div className="w-[56px] h-[56px] rounded-[8px] overflow-hidden bg-btnSimple flex-none">
                {post.thumbnail ? (
                  <ImageWithFallback
                    fallbackSrc={`/icons/platforms/${post.provider}.png`}
                    src={post.thumbnail}
                    alt=""
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-[11px] text-newTableText">
                    N/A
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
                <div className="flex items-center gap-[8px]">
                  <ImageWithFallback
                    fallbackSrc={`/icons/platforms/${post.provider}.png`}
                    src={post.picture || `/icons/platforms/${post.provider}.png`}
                    alt={post.channelName}
                    width={18}
                    height={18}
                    className="rounded-[4px]"
                  />
                  <span className="text-[12px] text-newTableText">
                    {post.channelName}
                  </span>
                  <span className="text-[12px] text-newTableText">
                    {dayjs(post.publishDate).format('MMM D, YYYY')}
                  </span>
                </div>
                <div className="text-[13px] leading-[18px]">
                  {excerpt(post.content)}
                </div>
                <div className="text-[12px] text-newTableText tabular-nums">
                  Reactions {formatMetricNumber(post.reactions)} · Comments{' '}
                  {formatMetricNumber(post.comments)}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
