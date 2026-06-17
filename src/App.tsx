import React, { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ExpiryCheckPage } from './pages/ExpiryCheckPage';
import { HomePage } from './pages/HomePage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { LogisticsCallPage } from './pages/LogisticsCallPage';
import { OperationalReportPage } from './pages/OperationalReportPage';
import { PackingCalculatorPage } from './pages/PackingCalculatorPage';
import { CelinePage } from './pages/shiftguide/CelinePage';
import { LexiquePage } from './pages/shiftguide/LexiquePage';
import { LinePulsePage } from './pages/shiftguide/LinePulsePage';
import { ModuleView } from './pages/shiftguide/ModuleView';
import { ShiftGuideHome } from './pages/shiftguide/ShiftGuideHome';
import { ShiftGuideLock } from './pages/shiftguide/ShiftGuideLock';
import { UrgencesPage } from './pages/shiftguide/UrgencesPage';
import { isShiftGuideUnlocked } from './hooks/useShiftGuideAuth';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return null;
}

function ShiftGuideGuard({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(isShiftGuideUnlocked);
  if (!unlocked) return <ShiftGuideLock onUnlock={() => setUnlocked(true)} />;
  return <>{children}</>;
}


export function App() {
  return (
    <Routes>
      {/* ShiftGuide — accès protégé par code */}
      <Route path="/shiftguide" element={<ShiftGuideGuard><CelinePage /></ShiftGuideGuard>} />
      <Route path="/shiftguide/modules" element={<ShiftGuideGuard><ShiftGuideHome /></ShiftGuideGuard>} />
      <Route path="/shiftguide/linepulse" element={<ShiftGuideGuard><LinePulsePage /></ShiftGuideGuard>} />
      <Route path="/shiftguide/module/:moduleId" element={<ShiftGuideGuard><ModuleView /></ShiftGuideGuard>} />
      <Route path="/shiftguide/lexique" element={<ShiftGuideGuard><LexiquePage /></ShiftGuideGuard>} />
      <Route path="/shiftguide/urgences" element={<ShiftGuideGuard><UrgencesPage /></ShiftGuideGuard>} />

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
