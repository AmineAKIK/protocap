import { useEffect, useState } from 'react';

const CELINE_MOBILE_BREAKPOINT = '(max-width: 1023px)';
const CELINE_DESKTOP_BREAKPOINT = '(min-width: 1024px)';
const KEYBOARD_THRESHOLD_PX = 120;
const MOBILE_NAV_RESERVE_PX = 80;
const MIN_CELINE_VIEWPORT_PX = 240;

export function computeCelineViewportHeight(
  layoutHeight: number,
  visibleHeight: number
): number {
  const keyboardOpen = visibleHeight < layoutHeight - KEYBOARD_THRESHOLD_PX;
  const mobileNavReserve = keyboardOpen ? 0 : MOBILE_NAV_RESERVE_PX;
  return Math.max(MIN_CELINE_VIEWPORT_PX, Math.floor(visibleHeight - mobileNavReserve));
}

function resetShiftGuideScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  document.querySelectorAll<HTMLElement>('.shiftguide-shell *').forEach((element) => {
    const { overflowY } = window.getComputedStyle(element);
    if ((overflowY === 'auto' || overflowY === 'scroll') && element.scrollTop !== 0) {
      element.scrollTop = 0;
    }
  });
}

function useManualScrollRestoration() {
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);
}

function useShiftGuideRouteReset(pathname: string, isCelineRoute: boolean) {
  useEffect(() => {
    resetShiftGuideScroll();

    const frame = window.requestAnimationFrame(() => {
      resetShiftGuideScroll();

      if (isCelineRoute && window.matchMedia(CELINE_DESKTOP_BREAKPOINT).matches) {
        const input = document.querySelector<HTMLInputElement>(
          '.shiftguide-shell input[type="text"]'
        );
        input?.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isCelineRoute, pathname]);
}

function useCelineDocumentLock(isCelineRoute: boolean) {
  useEffect(() => {
    if (!isCelineRoute) return;

    const media = window.matchMedia(CELINE_MOBILE_BREAKPOINT);
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    const updateRootLock = () => {
      if (media.matches) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        html.style.overflow = 'hidden';
        html.style.overscrollBehavior = 'none';
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
      } else {
        html.style.overflow = previousHtmlOverflow;
        html.style.overscrollBehavior = previousHtmlOverscroll;
        body.style.overflow = previousBodyOverflow;
        body.style.overscrollBehavior = previousBodyOverscroll;
      }
    };

    updateRootLock();
    media.addEventListener('change', updateRootLock);

    return () => {
      media.removeEventListener('change', updateRootLock);
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [isCelineRoute]);
}

function useCelineViewportHeight(isCelineRoute: boolean) {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!isCelineRoute) return;

    const media = window.matchMedia(CELINE_MOBILE_BREAKPOINT);
    const viewport = window.visualViewport;

    const updateViewportHeight = () => {
      if (!media.matches) {
        setHeight(null);
        return;
      }

      const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
      const visibleHeight = viewport?.height ?? layoutHeight;
      setHeight(computeCelineViewportHeight(layoutHeight, visibleHeight));
    };

    const initialFrame = window.requestAnimationFrame(updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);
    viewport?.addEventListener('resize', updateViewportHeight);
    viewport?.addEventListener('scroll', updateViewportHeight);
    media.addEventListener('change', updateViewportHeight);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.removeEventListener('resize', updateViewportHeight);
      viewport?.removeEventListener('resize', updateViewportHeight);
      viewport?.removeEventListener('scroll', updateViewportHeight);
      media.removeEventListener('change', updateViewportHeight);
    };
  }, [isCelineRoute]);

  return isCelineRoute ? height : null;
}

export function useShiftGuideShell(pathname: string) {
  const isCelineRoute = pathname === '/shiftguide/celine';
  const isMobileViewport = window.matchMedia(CELINE_MOBILE_BREAKPOINT).matches;

  useManualScrollRestoration();
  useShiftGuideRouteReset(pathname, isCelineRoute);
  useCelineDocumentLock(isCelineRoute);
  const celineViewportHeight = useCelineViewportHeight(isCelineRoute);

  return {
    isCelineRoute,
    isMobileViewport,
    celineViewportHeight,
  };
}
