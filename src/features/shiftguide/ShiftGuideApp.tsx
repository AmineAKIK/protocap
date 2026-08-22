import { lazy, Suspense } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { DemoBoundaryNotice } from '../../components/DemoBoundaryNotice';
import { ShiftGuideLayout } from '../../components/ShiftGuideLayout';
import {
  ShiftGuideAuthProvider,
  useShiftGuideAuth,
} from '../../context/ShiftGuideAuthContext';
import { getSgModules } from '../../data/shiftguideModules';
import { ShiftGuideLock } from '../../pages/shiftguide/ShiftGuideLock';

const CelinePage = lazy(() =>
  import('../../pages/shiftguide/CelinePage').then((module) => ({ default: module.CelinePage }))
);
const LexiquePage = lazy(() =>
  import('../../pages/shiftguide/LexiquePage').then((module) => ({ default: module.LexiquePage }))
);
const LinePulsePage = lazy(() =>
  import('../../pages/shiftguide/LinePulsePage').then((module) => ({ default: module.LinePulsePage }))
);
const LineAnalysisReportPage = lazy(() =>
  import('../../pages/shiftguide/LineAnalysisReportPage').then((module) => ({ default: module.LineAnalysisReportPage }))
);
const ModuleView = lazy(() =>
  import('../../pages/shiftguide/ModuleView').then((module) => ({ default: module.ModuleView }))
);
const ShiftGuideHome = lazy(() =>
  import('../../pages/shiftguide/ShiftGuideHome').then((module) => ({ default: module.ShiftGuideHome }))
);
const UrgencesPage = lazy(() =>
  import('../../pages/shiftguide/UrgencesPage').then((module) => ({ default: module.UrgencesPage }))
);

function RouteFallback({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center px-6 text-sm font-semibold text-slate-500">
      {label}
    </div>
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

function ShiftGuideRoutes() {
  return (
    <Routes>
      <Route element={<ShiftGuideGuard />}>
        <Route element={<ShiftGuideLayout />}>
          <Route index element={<ShiftGuideHome />} />
          <Route path="celine" element={<CelinePage />} />
          <Route path="home" element={<Navigate to="/shiftguide" replace />} />
          <Route path="modules" element={<Navigate to="/shiftguide" replace />} />
          <Route
            path="linepulse"
            element={(
              <DemoBoundaryNotice
                title="Démonstrateur"
                content="LinePulse utilise un jeu de données fictif statique. Les vues « temps réel » illustrent l'expérience cible et ne sont pas connectées à un flux usine."
              >
                <LinePulsePage />
              </DemoBoundaryNotice>
            )}
          />
          <Route path="analyse-ligne" element={<LineAnalysisReportPage />} />
          <Route path="module/:moduleId" element={<ShiftGuideModuleRoute />} />
          <Route path="lexique" element={<LexiquePage />} />
          <Route path="urgences" element={<UrgencesPage />} />
          <Route path="*" element={<ShiftGuideRouteState />} />
        </Route>
      </Route>
    </Routes>
  );
}

export function ShiftGuideApp() {
  return (
    <ShiftGuideAuthProvider>
      <ShiftGuideRoutes />
    </ShiftGuideAuthProvider>
  );
}
