import type { ReactNode } from 'react';

interface DemoBoundaryNoticeProps {
  title: string;
  children: ReactNode;
  content: ReactNode;
}

export function DemoBoundaryNotice({ title, children, content }: DemoBoundaryNoticeProps) {
  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-950 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 text-xs leading-5 sm:flex-row sm:items-baseline sm:gap-2">
          <strong className="shrink-0 font-black uppercase tracking-wide">{title}</strong>
          <span className="font-medium">{content}</span>
        </div>
      </div>
      {children}
    </>
  );
}
