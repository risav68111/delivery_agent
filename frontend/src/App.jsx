import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import { AppHeader } from './components/AppHeader.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { AgentDetailPage } from './pages/AgentDetailPage.jsx';
import { AgentsPage } from './pages/AgentsPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="app">
            <AppHeader />
            <main className="main">
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Navigate to="/agents" replace />} />
                  <Route path="/agents" element={<AgentsPage />} />
                  <Route path="/agents/:id" element={<AgentDetailPage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <footer className="footer">
              <span>Dispatch · Delivery Agent Management System</span>
              <span className="footer__stack">React · Express · PostgreSQL · Redis</span>
            </footer>
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
