import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { AuthProvider, useAuth } from './lib/auth';
import { BookingsPage } from './pages/BookingsPage';
import { CentresPage } from './pages/CentresPage';
import { MedicalCentresPage } from './pages/MedicalCentresPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { CmsPage } from './pages/CmsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { LoginPage } from './pages/LoginPage';
import { PatientsPage } from './pages/PatientsPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { TeamPage } from './pages/TeamPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<Shell />}>
                <Route index element={<DashboardPage />} />
                <Route path="doctors" element={<DoctorsPage />} />
                <Route path="medical-centres" element={<MedicalCentresPage />} />
                <Route path="centres" element={<CentresPage />} />
                <Route path="providers" element={<ProvidersPage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="patients" element={<PatientsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="cms" element={<CmsPage />} />
                <Route path="search" element={<SearchPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
