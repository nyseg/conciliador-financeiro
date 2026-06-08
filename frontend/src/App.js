import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import CadastroPage from './pages/CadastroPage';
import ClientesPage from './pages/ClientesPage';
import ClientePage from './pages/ClientePage';
import DashboardPage from './pages/DashboardPage';

function RoteiroProtegido({ children }) {
  const { analista, carregando } = useAuth();

  if (carregando) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 14,
        color: '#6B7280',
      }}>
        Carregando...
      </div>
    );
  }

  return analista ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route
            path="/clientes"
            element={
              <RoteiroProtegido>
                <ClientesPage />
              </RoteiroProtegido>
            }
          />
          <Route
            path="/clientes/:id"
            element={
              <RoteiroProtegido>
                <ClientePage />
              </RoteiroProtegido>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RoteiroProtegido>
                <DashboardPage />
              </RoteiroProtegido>
            }
          />
          <Route path="*" element={<Navigate to="/clientes" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
