export const APP_HEADER_HEIGHT_PX = 56;
export const SHIFTGUIDE_MOBILE_NAV_RESERVE_PX = 80;
export const SHIFTGUIDE_DESKTOP_NAV_WIDTH_PX = 96;
export const SHIFTGUIDE_DESKTOP_BREAKPOINT_PX = 1024;

export const SHIFTGUIDE_MOBILE_MEDIA_QUERY = `(max-width: ${SHIFTGUIDE_DESKTOP_BREAKPOINT_PX - 1}px)`;
export const SHIFTGUIDE_DESKTOP_MEDIA_QUERY = `(min-width: ${SHIFTGUIDE_DESKTOP_BREAKPOINT_PX}px)`;

export const RESPONSIVE_SHELL_CSS_VARS = {
  appHeaderHeight: '--app-header-height',
  shiftGuideMobileNavReserve: '--shiftguide-mobile-nav-reserve',
  shiftGuideDesktopNavWidth: '--shiftguide-desktop-nav-width',
} as const;
