import { lazy, Suspense, useEffect } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ShiftGuideLayout } from './components/ShiftGuideLayout';
import {
  ShiftGuideAuthProvider,
  useShiftGuideAuth,
} from './context/ShiftGuideAuthContext';
import { ShiftGuideLock } from './pages/shiftguide/ShiftGuideLock';

const ExpiryCheckPage = lazy(() =>
  import('./pages/ExpiryCheckPage').then((module) => ({ default: module.ExpiryCheckPage }))
);
const HomePage = lazy(() =>
  import('./pages/HomePage').then((module) => ({ default: module.HomePage }))
);
const KnowledgeBasePage = lazy(() =>
  import('./pages/KnowledgeBasePage').then((module) => ({ default: module.KnowledgeBasePage }))
);
const LogisticsCallPage = lazy(() =>
  import('./pages/LogisticsCallPage').then((module) => ({ default: module.LogisticsCallPage }))
);
const OperationalReportPage = lazy(() =>
  import('./pages/OperationalReportPage').then((module) => ({ default: module.OperationalReportPage }))
);
const PackingCalculatorPage = lazy(() =>
  import('./pages/PackingCalculatorPage').then((module) => ({ default: module.PackingCalculatorPage }))
);
const CelinePage = lazy(() =>
  import('./pages/shiftguide/CelinePage').then((module) => ({ default: module.CelinePage }))
);
const LexiquePage = lazy(() =>
  import('./pages/shiftguide/LexiquePage').then((module) => ({ default: module.LexiquePage }))
);
const LinePulsePage = lazy(() =>
  import('./pages/shiftguide/LinePulsePage').then((module) => ({ default: module.LinePulsePage }))
);
const LineAnalysisReportPage = lazy(() =>
  import('./pages/shiftguide/LineAnalysisReportPage').then((module) => ({ default: module.LineAnalysisReportPage }))
);
const ModuleView = lazy(() =>
  import('./pages/shiftguide/ModuleView').then((module) => ({ default: module.ModuleView }))
);
const ShiftGuideHome = lazy(() =>
  import('./pages/shiftguide/ShiftGuideHome').then((module) => ({ default: module.ShiftGuideHome }))
);
const UrgencesPage = lazy(() =>
  import('./pages/shiftguide/UrgencesPage').then((module) => ({ default: module.UrgencesPage }))
);

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return null;
}

function RouteFallback({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center px-6 text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}

function MainLayout() {
  return (
    <AppShell>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

function ShiftGuideGuard() {
  const { status, unlock } = useShiftGuideAuth();

  if (status === 'checking') {
    return <RouteFallback label="Vérification de la session ShiftGuide…" />;
  }

  if (status === 'locked') {
    return <ShiftGuideLock onUnlock={unlock} />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}

export function App() {
  return (
    <ShiftGuideAuthProvider>
      <Routes>
        <Route element={<ShiftGuideGuard />}>
          <Route element={<ShiftGuideLayout />}>
            <Route path="/shiftguide" element={<CelinePage />} />
            <Route path="/shiftguide/modules" element={<ShiftGuideHome />} />
            <Route path="/shiftguide/linepulse" element={<LinePulsePage />} />
            <Route path="/shiftguide/analyse-ligne" element={<LineAnalysisReportPage />} />
            <Route path="/shiftguide/module/:moduleId" element={<ModuleView />} />
            <Route path="/shiftguide/lexique" element={<LexiquePage />} />
            <Route path="/shiftguide/urgences" element={<UrgencesPage />} />
          </Route>
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/rapport" element={<OperationalReportPage />} />
          <Route path="/expiry-check" element={<ExpiryCheckPage />} />
          <Route path="/logistics-call" element={<LogisticsCallPage />} />
          <Route path="/knowledge-base/*" element={<KnowledgeBasePage />} />
          <Route path="/packing-calculator" element={<PackingCalculatorPage />} />
          <Route path="*" element={null} />
        </Route>
      </Routes>
    </ShiftGuideAuthProvider>
  );
}
