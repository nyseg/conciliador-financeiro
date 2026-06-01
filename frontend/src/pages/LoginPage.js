import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin } from '../api';
import { acordarServidor } from '../utils/servidor';

const COR_PRIMARIA = '#1A1A2E';
const COR_VERDE    = '#1D9E75';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email, setEmail]         = useState('');
  const [senha, setSenha]         = useState('');
  const [erro, setErro]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [acordando, setAcordando] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  // Pinga o servidor em background ao carregar a página
  // (aquece o Render antes do usuário terminar de preencher)
  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/`, {
      signal: AbortSignal.timeout(8000),
    }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);

    // Acorda o servidor se necessário
    setAcordando(true);
    setTentativa(0);
    const online = await acordarServidor((t) => setTentativa(t));
    setAcordando(false);

    if (!online) {
      setErro('❌ Não foi possível conectar ao servidor. Verifique se o backend está no ar no Render.');
      setLoading(false);
      return;
    }

    try {
      const res = await apiLogin({ email, senha });
      login(res.access_token, res.analista);
      navigate('/clientes', { replace: true });
    } catch (err) {
      if (!err.response) {
        setErro('🔌 Servidor não respondeu. Tente novamente em alguns segundos.');
      } else {
        setErro(err.response?.data?.detail || `Erro ${err.response.status} ao fazer login.`);
      }
    } finally {
      setLoading(false);
    }
  }

  const ocupado = loading || acordando;

  return (
    <div style={{
      minHeight: '100vh', background: '#F4F4F8',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', padding: '24px',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: COR_PRIMARIA, letterSpacing: '-0.5px' }}>
          Conciliador Financeiro
        </div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          BPO Financeiro — Conciliação automática de cartões
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '36px 40px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', width: '100%', maxWidth: 420,
      }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: COR_PRIMARIA }}>
          Entrar
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={estiloLabel}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="seu@email.com" style={estiloInput} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={estiloLabel}>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
              required placeholder="••••••" style={estiloInput} />
          </div>

          {/* Acordando servidor */}
          {acordando && (
            <div style={{ background: '#FEF3E2', border: '1px solid #F5D99A', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, color: '#7A4500', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={estiloSpinner} />
              ☕ Servidor acordando… tentativa {tentativa}/12
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              {erro}
            </div>
          )}

          <button type="submit" disabled={ocupado} style={{
            width: '100%', background: ocupado ? '#9CA3AF' : COR_VERDE,
            color: '#fff', border: 'none', borderRadius: 10, padding: '13px',
            fontSize: 15, fontWeight: 700, cursor: ocupado ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {ocupado ? <><span style={estiloSpinner} /> Aguardando servidor…</> : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#666' }}>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" style={{ color: COR_VERDE, fontWeight: 600, textDecoration: 'none' }}>
            Criar conta
          </Link>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const estiloLabel = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };
const estiloInput = { width: '100%', border: '1.5px solid #D1D5DB', borderRadius: 8,
  padding: '10px 12px', fontSize: 14, color: '#111', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit' };
const estiloSpinner = { display: 'inline-block', width: 14, height: 14,
  border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 };
