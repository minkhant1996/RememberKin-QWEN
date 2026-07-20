import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import api from './services/api';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/layout/Layout';
import RequiresFamily from './components/layout/RequiresFamily';
import Home from './pages/Home';
import Chat from './pages/Chat';
import MemoryDashboard from './pages/MemoryDashboard';
import Family from './pages/Family';
import Stories from './pages/Stories';
import Events from './pages/Events';
import Search from './pages/Search';
import Portraits from './pages/Portraits';
import SimulationDashboard from './pages/SimulationDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Join from './pages/Join';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { isAuthenticated, user, updateToken } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && !user?.familyId) {
      api.get<{ user: { familyId?: string }; token: string }>('/auth/me')
        .then(({ data }) => {
          if (data.user.familyId) {
            updateToken(data.token, data.user.familyId);
          }
        })
        .catch(() => {
          // silently ignore — user just won't have familyId until they join a family
        });
    }
  }, [isAuthenticated, user?.familyId]);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/join" element={<Join />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />
            <Route path="chat" element={<RequiresFamily featureName="Family Chat"><Chat /></RequiresFamily>} />
            <Route path="memory" element={<RequiresFamily featureName="Memory Dashboard"><MemoryDashboard /></RequiresFamily>} />
            <Route path="memories" element={<RequiresFamily featureName="Memory Dashboard"><MemoryDashboard /></RequiresFamily>} />
            <Route path="family" element={<Family />} />
            <Route path="portraits" element={<RequiresFamily featureName="AI Portraits"><Portraits /></RequiresFamily>} />
            <Route path="stories" element={<RequiresFamily featureName="Stories"><Stories /></RequiresFamily>} />
            <Route path="events" element={<RequiresFamily featureName="Family Events"><Events /></RequiresFamily>} />
            <Route path="search" element={<RequiresFamily featureName="Story Search"><Search /></RequiresFamily>} />
            <Route path="simulation" element={<SimulationDashboard />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
