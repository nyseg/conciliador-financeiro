import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin } from '../api';
import { apiComRetry } from '../utils/apiComRetry';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email, setEmail]     = useState('');
  const [senha, setSenha]     = useState('');
  const [erro, setErro]       = useState('');
  const [loading, setLoading]               = useState(false);
  const [tentativaRetry, setTentativaRetry] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setTentativaRetry(0);
    setLoading(true);
    try {
      const res = await apiComRetry(
        () => apiLogin({ email, senha }),
        (tent) => setTentativaRetry(tent),
      );
      login(res.access_token, res.analista);
      navigate('/clientes', { replace: true });
    } catch (err) {
      if (err.ehTimeoutServidor) {
        setErro('Servidor demorou para responder. Clique em "Entrar" novamente — agora será imediato.');
      } else {
        setErro(err.response?.data?.detail || err.message || 'Erro ao fazer login.');
      }
    } finally {
      setLoading(false);
      setTentativaRetry(0);
    }
  }

  const retryAtivo = loading && tentativaRetry > 0;

  return (
    <div style={s.root}>
      {/* Painel lateral escuro — some em mobile via CSS */}
      <div style={s.sidePanel} className="login-side-panel">
        <div style={s.sidePanelContent}>
          <div style={s.brandMark}>
            <span style={s.brandIcon}>💼</span>
          </div>
          <div style={s.sideTitle}>Conciliador<br />Financeiro</div>
          <div style={s.sideSubtitle}>
            Conciliação automática de cartões para escritórios BPO
          </div>
          <div style={s.sideFeatures}>
            <div style={s.featureItem}>
              <span style={s.featureDot} />
              Despesas vs ERP — Contas a Pagar
            </div>
            <div style={s.featureItem}>
              <span style={s.featureDot} />
              Receitas vs Operadora vs Banco
            </div>
            <div style={s.featureItem}>
              <span style={s.featureDot} />
              Exportação Excel completa
            </div>
          </div>
        </div>
      </div>

      {/* Área do formulário */}
      <div style={s.formArea}>
        {/* Logo mobile (visível só em telas pequenas via CSS) */}
        <div style={s.mobileLogo} className="login-mobile-logo">
          <span style={{ fontSize: 24 }}>💼</span>
          <span style={s.mobileLogoText}>Concil</span>
        </div>

        <div style={s.card}>
          <div style={s.logoRow}>
            <span style={s.logoIcon}>💼</span>
            <span style={s.logoName}>Concil</span>
          </div>
          <h1 style={s.title}>Entrar na conta</h1>
          <p style={s.tagline}>Conciliação financeira para BPO</p>

          <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
            <div style={s.fieldGroup}>
              <label style={s.label}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                style={s.input}
                onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Senha</label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                placeholder="••••••••"
                style={s.input}
                onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {retryAtivo && (
              <div style={s.alertWarning}>
                <span style={s.spinner} />
                Servidor iniciando… nova tentativa {tentativaRetry}/3
              </div>
            )}

            {erro && (
              <div style={s.alertDanger}>{erro}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...s.btnPrimary,
                background: loading ? '#94A3B8' : '#2563EB',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1D4ED8'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#2563EB'; }}
            >
              {loading
                ? <><span style={s.spinner} /> {retryAtivo ? 'Reconectando…' : 'Entrando…'}</>
                : 'Entrar'}
            </button>
          </form>

          <div style={s.footerLink}>
            Ainda não tem conta?{' '}
            <Link to="/cadastro" style={s.link}>Criar conta</Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .login-side-panel { display: none !important; }
          .login-mobile-logo { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

const s = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif',
    background: '#F8FAFC',
  },
  sidePanel: {
    width: '32%',
    minWidth: 260,
    background: '#0F172A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
    flexShrink: 0,
  },
  sidePanelContent: {
    maxWidth: 280,
  },
  brandMark: {
    width: 52,
    height: 52,
    background: 'rgba(37,99,235,0.2)',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    fontSize: 26,
  },
  brandIcon: {},
  sideTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#F8FAFC',
    lineHeight: 1.25,
    marginBottom: 14,
    letterSpacing: '-0.5px',
  },
  sideSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 1.6,
    marginBottom: 32,
  },
  sideFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#CBD5E1',
  },
  featureDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#2563EB',
    flexShrink: 0,
  },
  formArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  mobileLogo: {
    display: 'none',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  mobileLogoText: {
    fontSize: 22,
    fontWeight: 700,
    color: '#2563EB',
    letterSpacing: '-0.3px',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: 16,
    padding: '40px 44px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
    border: '1px solid #E2E8F0',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 22,
  },
  logoName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#2563EB',
    letterSpacing: '-0.3px',
  },
  title: {
    margin: '0 0 4px',
    fontSize: 24,
    fontWeight: 700,
    color: '#0F172A',
    letterSpacing: '-0.4px',
  },
  tagline: {
    margin: 0,
    fontSize: 14,
    color: '#94A3B8',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    border: '1.5px solid #E2E8F0',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: '#0F172A',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#FFFFFF',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  },
  alertWarning: {
    background: '#FFFBEB',
    border: '1px solid #FDE68A',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#92400E',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  alertDanger: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
  },
  btnPrimary: {
    width: '100%',
    background: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 8,
    padding: '11px 20px',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '0.01em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 150ms ease',
  },
  spinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2.5px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  footerLink: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 13,
    color: '#94A3B8',
  },
  link: {
    color: '#2563EB',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
