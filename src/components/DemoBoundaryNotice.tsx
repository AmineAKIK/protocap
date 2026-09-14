import type { ReactNode } from 'react';
import { PageFrame } from './PageFrame';

interface DemoBoundaryNoticeProps {
  title: string;
  children: ReactNode;
  content: ReactNode;
}

export function DemoBoundaryNotice({ title, children, content }: DemoBoundaryNoticeProps) {
  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 py-2.5 text-amber-950">
        <PageFrame className="flex flex-col gap-1 text-xs leading-5 sm:flex-row sm:items-baseline sm:gap-2">
          <strong className="break-normal font-black uppercase tracking-wide sm:shrink-0">{title}</strong>
          <span className="min-w-0 break-normal font-medium">{content}</span>
        </PageFrame>
      </div>
      {children}
    </>
  );
}
