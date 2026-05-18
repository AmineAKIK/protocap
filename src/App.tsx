import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ExpiryCheckPage } from './pages/ExpiryCheckPage';
import { HomePage } from './pages/HomePage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { LogisticsCallPage } from './pages/LogisticsCallPage';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/expiry-check" element={<ExpiryCheckPage />} />
        <Route path="/logistics-call" element={<LogisticsCallPage />} />
        <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
      </Routes>
    </AppShell>
  );
}
