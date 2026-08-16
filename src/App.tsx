import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { AuthProvider, useAuth } from './lib/auth';
import { BookingsPage } from './pages/BookingsPage';
import { CentresPage } from './pages/CentresPage';
import { MedicalCentresPage } from './pages/MedicalCentresPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PatientsPage } from './pages/PatientsPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { TeamPage } from './pages/TeamPage';
import {
  DiagnosticsConfigPage,
  DiscoveryConfigPage,
  PharmacyConfigPage,
  TestimonialsConfigPage,
} from './pages/app-config/CatalogConfigPages';
import { HomeContentPage } from './pages/app-config/HomeContentPage';
import { SupportConfigPage } from './pages/app-config/SupportConfigPage';

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
                <Route path="reports/analytics" element={<ReportsPage />} />
                <Route path="app-config/home" element={<HomeContentPage />} />
                <Route path="app-config/discovery" element={<DiscoveryConfigPage />} />
                <Route path="app-config/diagnostics" element={<DiagnosticsConfigPage />} />
                <Route path="app-config/pharmacy" element={<PharmacyConfigPage />} />
                <Route path="app-config/testimonials" element={<TestimonialsConfigPage />} />
                <Route path="app-config/support" element={<SupportConfigPage />} />
                <Route path="onboarding" element={<OnboardingPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="cms" element={<Navigate to="/app-config/home" replace />} />
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
