import { lazy, Suspense, useEffect } from 'react';
import { Link, Outlet, Route, Routes, useLocation } from 'react-router-dom';
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

function PublicNotFound() {
  return (
    <main className="grid min-h-[65vh] place-items-center px-6 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">404 · Protocap</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Page introuvable</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
          Cette destination n’existe pas ou a été déplacée.
        </p>
        <Link
          to="/"
          replace
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-700/20"
        >
          Revenir à l’accueil
        </Link>
      </section>
    </main>
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
        <Route path="*" element={<PublicNotFound />} />
      </Route>
    </Routes>
  );
}
