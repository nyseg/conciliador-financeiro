import { createContext, useContext, useState, useEffect } from 'react';
import { buscarMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [analista, setAnalista]   = useState(null);
  const [token, setToken]         = useState(() => localStorage.getItem('token'));
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (token) {
      // Usa o `api` (proxy do Vercel + interceptor de token) — nunca localhost direto.
      // Só remove o token em erro de AUTENTICAÇÃO (401/403); erro de rede mantém a sessão.
      buscarMe()
        .then(d => setAnalista(d))
        .catch(err => {
          const status = err.response?.status;
          if (status === 401 || status === 403) {
            localStorage.removeItem('token');
            setToken(null);
          }
          // erro de rede / cold start: mantém o token, não desloga
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
