import { lazy, Suspense, useEffect } from 'react';
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { DemoBoundaryNotice } from './components/DemoBoundaryNotice';
import { ShiftGuideLayout } from './components/ShiftGuideLayout';
import {
  ShiftGuideAuthProvider,
  useShiftGuideAuth,
} from './context/ShiftGuideAuthContext';
import { getSgModules } from './data/shiftguideModules';
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
const PilotProposalPage = lazy(() =>
  import('./pages/PilotProposalPage').then((module) => ({ default: module.PilotProposalPage }))
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

function ShiftGuideRouteState({
  title = 'Page introuvable',
  detail = "Cette destination n'existe pas dans ShiftGuide.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-5 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-7 text-center shadow-xl shadow-zinc-200/50">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-700">ShiftGuide</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950">{title}</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">{detail}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            to="/shiftguide"
            replace
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-zinc-800"
          >
            Retour à l'accueil
          </Link>
          <Link
            to="/shiftguide/celine"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-50 px-4 text-sm font-black text-teal-800 ring-1 ring-teal-100 transition hover:bg-teal-100"
          >
            Ouvrir Céline
          </Link>
        </div>
      </section>
    </main>
  );
}

function ShiftGuideModuleRoute() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const exists = !!moduleId && getSgModules().some((module) => module.id === moduleId);

  if (!exists) {
    return (
      <ShiftGuideRouteState
        title="Module introuvable"
        detail="Ce module n'existe pas ou n'est plus disponible dans la configuration ShiftGuide actuelle."
      />
    );
  }

  return <ModuleView />;
}

export function App() {
  return (
    <ShiftGuideAuthProvider>
      <Routes>
        <Route element={<ShiftGuideGuard />}>
          <Route element={<ShiftGuideLayout />}>
            <Route path="/shiftguide" element={<ShiftGuideHome />} />
            <Route path="/shiftguide/celine" element={<CelinePage />} />
            <Route path="/shiftguide/home" element={<Navigate to="/shiftguide" replace />} />
            <Route path="/shiftguide/modules" element={<Navigate to="/shiftguide" replace />} />
            <Route
              path="/shiftguide/linepulse"
              element={(
                <DemoBoundaryNotice
                  title="Démonstrateur"
                  content="LinePulse utilise un jeu de données fictif statique. Les vues « temps réel » illustrent l'expérience cible et ne sont pas connectées à un flux usine."
                >
                  <LinePulsePage />
                </DemoBoundaryNotice>
              )}
            />
            <Route path="/shiftguide/analyse-ligne" element={<LineAnalysisReportPage />} />
            <Route path="/shiftguide/module/:moduleId" element={<ShiftGuideModuleRoute />} />
            <Route path="/shiftguide/lexique" element={<LexiquePage />} />
            <Route path="/shiftguide/urgences" element={<UrgencesPage />} />
            <Route path="/shiftguide/*" element={<ShiftGuideRouteState />} />
          </Route>
        </Route>

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
    </ShiftGuideAuthProvider>
  );
}
