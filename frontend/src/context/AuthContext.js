import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [analista, setAnalista]   = useState(null);
  const [token, setToken]         = useState(() => localStorage.getItem('token'));
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (token) {
      fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => setAnalista(d))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setCarregando(false));
    } else {
      setCarregando(false);
    }
  }, [token]);

  function login(novoToken, dadosAnalista) {
    localStorage.setItem('token', novoToken);
    setToken(novoToken);
    setAnalista(dadosAnalista);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setAnalista(null);
  }

  return (
    <AuthContext.Provider value={{ analista, token, login, logout, carregando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
