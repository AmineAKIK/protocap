import { lazy, Suspense, useEffect } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { DemoBoundaryNotice } from './components/DemoBoundaryNotice';

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
const PilotProposalPage = lazy(() =>
  import('./pages/PilotProposalPage').then((module) => ({ default: module.PilotProposalPage }))
);
const ShiftGuideApp = lazy(() =>
  import('./features/shiftguide/ShiftGuideApp').then((module) => ({ default: module.ShiftGuideApp }))
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

export function App() {
  return (
    <Routes>
      <Route
        path="/shiftguide/*"
        element={(
          <Suspense fallback={<RouteFallback label="Chargement de ShiftGuide…" />}>
            <ShiftGuideApp />
          </Suspense>
        )}
      />

      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/rapport"
          element={(
            <DemoBoundaryNotice
              title="Cadre d'évaluation"
              content="Les impacts et indicateurs présentés sont des hypothèses de conception et des critères de mesure proposés, pas des résultats de production mesurés."
            >
              <OperationalReportPage />
            </DemoBoundaryNotice>
          )}
        />
        <Route path="/proposition-pilote" element={<PilotProposalPage />} />
        <Route path="/expiry-check" element={<ExpiryCheckPage />} />
        <Route
          path="/logistics-call"
          element={(
            <DemoBoundaryNotice
              title="Démonstrateur local"
              content="Le board est persisté dans ce navigateur uniquement. Il n'y a pas encore de synchronisation multi-utilisateur ou temps réel."
            >
              <LogisticsCallPage />
            </DemoBoundaryNotice>
          )}
        />
        <Route path="/knowledge-base/*" element={<KnowledgeBasePage />} />
        <Route path="/packing-calculator" element={<PackingCalculatorPage />} />
        <Route path="*" element={null} />
      </Route>
    </Routes>
  );
}
