import type { ReactNode } from 'react';

type PageFrameWidth = 'standard' | 'wide';
type PageFrameGutter = 'standard' | 'compact';

interface PageFrameProps {
  children: ReactNode;
  className?: string;
  width?: PageFrameWidth;
  gutter?: PageFrameGutter;
}

const widthClass: Record<PageFrameWidth, string> = {
  standard: 'max-w-7xl',
  wide: 'max-w-[1500px]',
};

const gutterClass: Record<PageFrameGutter, string> = {
  standard: 'px-4 sm:px-6 lg:px-8',
  compact: 'px-3 sm:px-6 lg:px-8',
};

export function PageFrame({
  children,
  className = '',
  width = 'standard',
  gutter = 'standard',
}: PageFrameProps) {
  return (
    <div className={`mx-auto w-full min-w-0 ${widthClass[width]} ${gutterClass[gutter]} ${className}`}>
      {children}
    </div>
  );
}
