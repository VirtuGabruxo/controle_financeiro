import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import UpdatePassword from './pages/UpdatePassword';
import Settings from './pages/Settings';
import Incomes from './pages/Incomes';
import Expenses from './pages/Expenses';
import Cards from './pages/Cards';
import Goals from './pages/Goals';
import Reports from './pages/Reports';
import NetWorth from './pages/NetWorth';
import ExportarDados from './pages/ExportarDados';

import { useIdleTimeout } from './hooks/useIdleTimeout';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  // Ativa a verificação Nível Bancário: 5 minutos de inatividade
  useIdleTimeout(5);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400 mb-4" size={48} />
        <p className="text-muted font-medium animate-pulse">Autenticando sessão segura...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          
          <Route element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/incomes" element={<Incomes />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/cards" element={<Cards />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/net-worth" element={<NetWorth />} />
            <Route path="/export" element={<ExportarDados />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
