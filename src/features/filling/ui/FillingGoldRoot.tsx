import { Navigate, Route, Routes } from 'react-router-dom';
import { FillingGoldProvider, useFillingGold } from '../application/FillingGoldContext';
import { FillingBackupPage } from './FillingBackupPage';
import { FillingDashboardPage } from './FillingDashboardPage';
import { FillingHistoryPage } from './FillingHistoryPage';
import { FillingProfilesPage } from './FillingProfilesPage';
import { FillingSessionPage } from './FillingSessionPage';
import { FillingShell } from './FillingShell';
import { FillingVaultGate } from './FillingVaultGate';

function FillingGoldRoutes() {
  const { lockVault } = useFillingGold();
  return (
    <FillingVaultGate>
      <FillingShell onLock={lockVault}>
        <Routes>
          <Route index element={<FillingDashboardPage />} />
          <Route path="profils" element={<FillingProfilesPage />} />
          <Route path="historique" element={<FillingHistoryPage />} />
          <Route path="sauvegarde" element={<FillingBackupPage />} />
          <Route path="session/:sessionId" element={<FillingSessionPage />} />
          <Route path="*" element={<Navigate to="/shiftguide/remplissage" replace />} />
        </Routes>
      </FillingShell>
    </FillingVaultGate>
  );
}

export function FillingGoldRoot() {
  return (
    <FillingGoldProvider>
      <FillingGoldRoutes />
    </FillingGoldProvider>
  );
}
