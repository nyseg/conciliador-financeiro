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

  function focar(e) { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(26,68,128,0.12)'; }
  function desfocar(e) { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }

  return (
    <div style={s.root}>
      {/* Painel lateral navy — some em mobile via CSS */}
      <div style={s.sidePanel} className="login-side-panel">
        <div style={s.sidePanelContent}>
          <div style={s.brandMark}>F</div>
          <div style={s.sideTitle}>Fincil</div>
          <div style={s.sideSubtitle}>
            Conciliação financeira automática para escritórios BPO
          </div>
          <div style={s.sideFeatures}>
            <div style={s.featureItem}><span style={s.featureDot} />Despesas vs ERP — Contas a Pagar</div>
            <div style={s.featureItem}><span style={s.featureDot} />Receitas vs Operadora vs Banco</div>
            <div style={s.featureItem}><span style={s.featureDot} />Exportação Excel completa</div>
          </div>
        </div>
      </div>

      {/* Área do formulário */}
      <div style={s.formArea}>
        <div style={s.mobileLogo} className="login-mobile-logo">
          <span style={s.mobileMark}>F</span>
          <span style={s.mobileLogoText}>Fincil</span>
        </div>

        <div style={s.card}>
          <div style={s.logoRow}>
            <span style={s.logoMark}>F</span>
            <span style={s.logoName}>Fincil</span>
          </div>
          <h1 style={s.title}>Entrar na conta</h1>
          <p style={s.tagline}>Finance + Reconcile — BPO Financeiro</p>

          <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
            <div style={s.fieldGroup}>
              <label style={s.label}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="seu@email.com" style={s.input} onFocus={focar} onBlur={desfocar} />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Senha</label>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                required placeholder="••••••••" style={s.input} onFocus={focar} onBlur={desfocar} />
            </div>

            {retryAtivo && (
              <div style={s.alertWarning}>
                <span style={s.spinner} />
                Servidor iniciando… nova tentativa {tentativaRetry}/3
              </div>
            )}

            {erro && <div style={s.alertDanger}>{erro}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...s.btnPrimary,
                background: loading ? '#A9B6C8' : 'var(--accent)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-l)'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--accent)'; }}
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

const markBase = {
  background: 'linear-gradient(135deg, #2558A8, #5A9EFF)',
  color: '#fff', fontFamily: 'var(--font-serif)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

const s = {
  root: { minHeight: '100vh', display: 'flex', fontFamily: 'var(--font-body)', background: 'var(--bg)' },
  sidePanel: {
    width: '32%', minWidth: 260, background: 'var(--primary-d)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '48px 40px', flexShrink: 0,
  },
  sidePanelContent: { maxWidth: 280 },
  brandMark: { ...markBase, width: 52, height: 52, borderRadius: 14, fontSize: 26, marginBottom: 24 },
  sideTitle: {
    fontFamily: 'var(--font-serif)', fontSize: 34, color: '#fff',
    lineHeight: 1.1, marginBottom: 14,
  },
  sideSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 32 },
  sideFeatures: { display: 'flex', flexDirection: 'column', gap: 12 },
  featureItem: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  featureDot: { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 },
  formArea: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' },
  mobileLogo: { display: 'none', alignItems: 'center', gap: 10, marginBottom: 32 },
  mobileMark: { ...markBase, width: 34, height: 34, borderRadius: 9, fontSize: 18 },
  mobileLogoText: { fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--primary)' },
  card: {
    background: '#FFFFFF', borderRadius: 16, padding: '40px 44px', width: '100%', maxWidth: 420,
    boxShadow: '0 6px 24px rgba(11,31,58,0.10)', border: '1px solid var(--border)',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  logoMark: { ...markBase, width: 32, height: 32, borderRadius: 8, fontSize: 17 },
  logoName: { fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--primary)' },
  title: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.4px' },
  tagline: { margin: 0, fontSize: 13.5, color: 'var(--text-3)' },
  fieldGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 },
  input: {
    width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', background: '#FFFFFF', transition: 'border-color 150ms ease, box-shadow 150ms ease',
  },
  alertWarning: {
    background: 'var(--warn-bg)', border: '1px solid #F5D99A', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, color: 'var(--warn)', marginBottom: 16,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  alertDanger: {
    background: 'var(--err-bg)', border: '1px solid #F5C6C6', color: 'var(--err)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
  },
  btnPrimary: {
    width: '100%', background: 'var(--accent)', color: '#FFFFFF', border: 'none',
    borderRadius: 8, padding: '11px 20px', fontSize: 15, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 150ms ease',
  },
  spinner: {
    display: 'inline-block', width: 14, height: 14, border: '2.5px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
  },
  footerLink: { marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' },
  link: { color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' },
};
