import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SidebarLayout } from './layouts/SidebarLayout';
import { Dashboard } from './pages/Dashboard';
import { ProductionLogEntry } from './pages/ProductionLogEntry';
import { Materials } from './pages/Materials';
import { Moulds } from './pages/Moulds';
import { Vendors } from './pages/Vendors';
import { Assignments } from './pages/Assignments';
import { EditRequests } from './pages/EditRequests';
import { Logs } from './pages/Logs';
import { Repairs } from './pages/Repairs';
import { Analytics } from './pages/Analytics';
import { Copilot } from './pages/Copilot';
import { Settings } from './pages/Settings';
import { Support } from './pages/Support';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><SidebarLayout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="logs" element={<Logs />} />
        <Route path="logs/new" element={<ProductionLogEntry />} />
        <Route path="moulds" element={<Moulds />} />
        <Route path="materials" element={<Materials />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="repairs" element={<Repairs />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="edit-requests" element={<EditRequests />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="copilot" element={<Copilot />} />
        <Route path="settings" element={<Settings />} />
        <Route path="support" element={<Support />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
