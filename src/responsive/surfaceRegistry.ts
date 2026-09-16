export type ResponsiveSurfaceCoverage = 'browser-contract' | 'specialized-contract';

export interface ResponsiveSurface {
  id: string;
  route: string;
  coverage: ResponsiveSurfaceCoverage;
  contractRef: string;
}

/**
 * Principal user-facing surfaces that must have named responsive coverage.
 *
 * Route additions are intentionally explicit: a new principal surface must be
 * registered here and backed by either the shared browser contract or a
 * specialized responsive contract. Redirect-only and wildcard fallback routes
 * are not principal surfaces.
 */
export const RESPONSIVE_SURFACES: readonly ResponsiveSurface[] = [
  { id: 'home', route: '/', coverage: 'browser-contract', contractRef: 'home' },
  { id: 'essay', route: '/essai', coverage: 'browser-contract', contractRef: 'essay' },
  { id: 'report', route: '/rapport', coverage: 'browser-contract', contractRef: 'report' },
  { id: 'pilot', route: '/proposition-pilote', coverage: 'browser-contract', contractRef: 'pilot' },
  { id: 'expiry', route: '/expiry-check', coverage: 'browser-contract', contractRef: 'expiry' },
  { id: 'logistics', route: '/logistics-call', coverage: 'browser-contract', contractRef: 'logistics' },
  { id: 'knowledge-base', route: '/knowledge-base/*', coverage: 'browser-contract', contractRef: 'knowledge-base' },
  { id: 'packing', route: '/packing-calculator', coverage: 'specialized-contract', contractRef: 'packing-responsive-contract' },
  { id: 'shiftguide-home', route: '/shiftguide', coverage: 'browser-contract', contractRef: 'shiftguide-home' },
  { id: 'shiftguide-celine', route: '/shiftguide/celine', coverage: 'browser-contract', contractRef: 'shiftguide-celine' },
  { id: 'shiftguide-linepulse', route: '/shiftguide/linepulse', coverage: 'browser-contract', contractRef: 'shiftguide-linepulse' },
  { id: 'shiftguide-analysis', route: '/shiftguide/analyse-ligne', coverage: 'browser-contract', contractRef: 'shiftguide-analysis' },
  { id: 'shiftguide-module', route: '/shiftguide/module/:moduleId', coverage: 'browser-contract', contractRef: 'shiftguide-module' },
  { id: 'shiftguide-lexique', route: '/shiftguide/lexique', coverage: 'browser-contract', contractRef: 'shiftguide-lexique' },
  { id: 'shiftguide-urgences', route: '/shiftguide/urgences', coverage: 'browser-contract', contractRef: 'shiftguide-urgences' },
] as const;
