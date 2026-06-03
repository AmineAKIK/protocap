import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ExpiryCheckPage } from './pages/ExpiryCheckPage';
import { HomePage } from './pages/HomePage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { LogisticsCallPage } from './pages/LogisticsCallPage';
import { OperationalReportPage } from './pages/OperationalReportPage';
import { PackingCalculatorPage } from './pages/PackingCalculatorPage';
import { LexiquePage } from './pages/shiftguide/LexiquePage';
import { ModuleView } from './pages/shiftguide/ModuleView';
import { ShiftGuideHome } from './pages/shiftguide/ShiftGuideHome';
import { UrgencesPage } from './pages/shiftguide/UrgencesPage';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return null;
}

export function App() {
  return (
    <Routes>
      {/* ShiftGuide — full-screen dark experience, outside AppShell */}
      <Route path="/shiftguide" element={<ShiftGuideHome />} />
      <Route path="/shiftguide/module/:moduleId" element={<ModuleView />} />
      <Route path="/shiftguide/lexique" element={<LexiquePage />} />
      <Route path="/shiftguide/urgences" element={<UrgencesPage />} />

      {/* Main app */}
      <Route
        path="*"
        element={
          <AppShell>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/rapport" element={<OperationalReportPage />} />
              <Route path="/expiry-check" element={<ExpiryCheckPage />} />
              <Route path="/logistics-call" element={<LogisticsCallPage />} />
              <Route path="/knowledge-base/*" element={<KnowledgeBasePage />} />
              <Route path="/packing-calculator" element={<PackingCalculatorPage />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}
