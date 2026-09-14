import { useEffect, useState } from 'react';
import {
  SHIFTGUIDE_DESKTOP_MEDIA_QUERY,
  SHIFTGUIDE_MOBILE_MEDIA_QUERY,
  SHIFTGUIDE_MOBILE_NAV_RESERVE_PX,
} from '../layout/responsiveGeometry';

const KEYBOARD_THRESHOLD_PX = 120;
const MIN_CELINE_VIEWPORT_PX = 240;
const SHIFTGUIDE_CONTENT_SELECTOR = '[data-shiftguide-shell] [data-shell-content]';

export interface CelineViewportGeometry {
  height: number;
  offsetTop: number;
}

export function computeCelineViewportGeometry(
  layoutHeight: number,
  visibleHeight: number,
  visibleOffsetTop = 0
): CelineViewportGeometry {
  const keyboardOpen = visibleHeight < layoutHeight - KEYBOARD_THRESHOLD_PX;
  const mobileNavReserve = keyboardOpen ? 0 : SHIFTGUIDE_MOBILE_NAV_RESERVE_PX;

  return {
    height: Math.max(MIN_CELINE_VIEWPORT_PX, Math.floor(visibleHeight - mobileNavReserve)),
    offsetTop: Math.max(0, Math.floor(visibleOffsetTop)),
  };
}

export function computeCelineViewportHeight(
  layoutHeight: number,
  visibleHeight: number
): number {
  return computeCelineViewportGeometry(layoutHeight, visibleHeight).height;
}

function resetShiftGuideScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const content = document.querySelector<HTMLElement>(SHIFTGUIDE_CONTENT_SELECTOR);
  if (!content) return;

  const scrollableElements = [content, ...content.querySelectorAll<HTMLElement>('*')];
  scrollableElements.forEach((element) => {
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

      if (isCelineRoute && window.matchMedia(SHIFTGUIDE_DESKTOP_MEDIA_QUERY).matches) {
        const input = document.querySelector<HTMLInputElement>(
          `${SHIFTGUIDE_CONTENT_SELECTOR} input[type="text"]`
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

    const media = window.matchMedia(SHIFTGUIDE_MOBILE_MEDIA_QUERY);
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

function useCelineViewportGeometry(isCelineRoute: boolean) {
  const [geometry, setGeometry] = useState<CelineViewportGeometry | null>(null);

  useEffect(() => {
    if (!isCelineRoute) return;

    const media = window.matchMedia(SHIFTGUIDE_MOBILE_MEDIA_QUERY);
    const viewport = window.visualViewport;

    const updateViewportGeometry = () => {
      if (!media.matches) {
        setGeometry(null);
        return;
      }

      const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
      const visibleHeight = viewport?.height ?? layoutHeight;
      const visibleOffsetTop = viewport?.offsetTop ?? 0;
      setGeometry(computeCelineViewportGeometry(layoutHeight, visibleHeight, visibleOffsetTop));
    };

    const initialFrame = window.requestAnimationFrame(updateViewportGeometry);
    window.addEventListener('resize', updateViewportGeometry);
    viewport?.addEventListener('resize', updateViewportGeometry);
    viewport?.addEventListener('scroll', updateViewportGeometry);
    media.addEventListener('change', updateViewportGeometry);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.removeEventListener('resize', updateViewportGeometry);
      viewport?.removeEventListener('resize', updateViewportGeometry);
      viewport?.removeEventListener('scroll', updateViewportGeometry);
      media.removeEventListener('change', updateViewportGeometry);
    };
  }, [isCelineRoute]);

  return isCelineRoute ? geometry : null;
}

export function useShiftGuideShell(pathname: string) {
  const isCelineRoute = pathname === '/shiftguide/celine';
  const isMobileViewport = window.matchMedia(SHIFTGUIDE_MOBILE_MEDIA_QUERY).matches;

  useManualScrollRestoration();
  useShiftGuideRouteReset(pathname, isCelineRoute);
  useCelineDocumentLock(isCelineRoute);
  const celineViewportGeometry = useCelineViewportGeometry(isCelineRoute);

  return {
    isCelineRoute,
    isMobileViewport,
    celineViewportGeometry,
  };
}
