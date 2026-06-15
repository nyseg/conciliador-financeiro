import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registrar } from '../api';
import { apiComRetry } from '../utils/apiComRetry';

const REGRAS = [
  { id: 'len',     label: 'Mínimo 8 caracteres',             test: s => s.length >= 8 },
  { id: 'upper',   label: 'Pelo menos uma letra maiúscula',   test: s => /[A-Z]/.test(s) },
  { id: 'number',  label: 'Pelo menos um número',             test: s => /[0-9]/.test(s) },
  { id: 'special', label: 'Pelo menos um caractere especial (!@#$%...)',
                                                               test: s => /[!@#$%^&*()\-_=+\[\]{}|;:,.<>?/\\~`]/.test(s) },
];

function SenhaRequisitos({ senha }) {
  if (!senha) return null;
  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      {REGRAS.map(r => {
        const ok = r.test(senha);
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: ok ? 'var(--ok)' : 'var(--border)', fontSize: 14, fontWeight: 700 }}>{ok ? '✓' : '○'}</span>
            <span style={{ color: ok ? 'var(--text-2)' : 'var(--text-3)' }}>{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function CadastroPage() {
  const navigate = useNavigate();

  const [nome, setNome]           = useState('');
  const [email, setEmail]         = useState('');
  const [senha, setSenha]         = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro]           = useState('');
  const [sucesso, setSucesso]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [senhaFocada, setSenhaFocada] = useState(false);
  const [tentativaRetry, setTentativaRetry] = useState(0);

  const senhaValida  = REGRAS.every(r => r.test(senha));
  const senhasIguais = senha === confirmar && confirmar.length > 0;
  const podeEnviar   = nome && email && senhaValida && senhasIguais;

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setTentativaRetry(0);

    if (!senhaValida) {
      const faltando = REGRAS.filter(r => !r.test(senha)).map(r => r.label);
      setErro('Senha fraca. Faltando: ' + faltando.join('; '));
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await apiComRetry(
        () => registrar({ nome, email, senha }),
        (tent) => setTentativaRetry(tent),
      );
      setSucesso('Conta criada com sucesso! Redirecionando...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      if (err.ehTimeoutServidor) {
        setErro('O servidor demorou para responder. Clique em "Criar conta" novamente — agora será imediato.');
      } else {
        setErro(err.response?.data?.detail || err.message || 'Erro ao criar conta.');
      }
    } finally {
      setLoading(false);
      setTentativaRetry(0);
    }
  }

  const retryAtivo = loading && tentativaRetry > 0;

  function inputFocus(e) {
    e.target.style.borderColor = 'var(--primary)';
    e.target.style.boxShadow = '0 0 0 3px rgba(26,68,128,0.12)';
  }
  function inputBlur(e) {
    e.target.style.borderColor = 'var(--border)';
    e.target.style.boxShadow = 'none';
  }

  return (
    <div style={s.root}>
      {/* Painel lateral */}
      <div style={s.sidePanel} className="login-side-panel">
        <div style={s.sidePanelContent}>
          <div style={s.brandMark}>F</div>
          <div style={s.sideTitle}>Fincil</div>
          <div style={s.sideSubtitle}>
            Crie sua conta e comece a conciliar os dados dos seus clientes de forma automática.
          </div>
          <div style={s.sideFeatures}>
            <div style={s.featureItem}><span style={s.featureDot} />Acesso seguro com senha forte</div>
            <div style={s.featureItem}><span style={s.featureDot} />Múltiplos clientes por conta</div>
            <div style={s.featureItem}><span style={s.featureDot} />Histórico completo de conciliações</div>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div style={s.formArea}>
        <div style={s.card}>
          <div style={s.logoRow}>
            <span style={s.logoMark}>F</span>
            <span style={s.logoName}>Fincil</span>
          </div>
          <h1 style={s.title}>Criar conta</h1>
          <p style={s.tagline}>Preencha os dados abaixo para começar</p>

          <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Nome completo</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
                placeholder="Seu nome"
                style={s.input}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                style={s.input}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Senha</label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                onFocus={e => { setSenhaFocada(true); inputFocus(e); }}
                onBlur={inputBlur}
                required
                placeholder="Crie uma senha forte"
                style={{
                  ...s.input,
                  borderColor: senha ? (senhaValida ? '#059669' : '#D97706') : '#E2E8F0',
                }}
              />
              {(senhaFocada || senha) && <SenhaRequisitos senha={senha} />}
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Confirmar senha</label>
              <input
                type="password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                required
                placeholder="Repita a senha"
                style={{
                  ...s.input,
                  borderColor: confirmar ? (senhasIguais ? '#059669' : '#DC2626') : '#E2E8F0',
                }}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
              {confirmar && !senhasIguais && (
                <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>As senhas não coincidem</div>
              )}
              {confirmar && senhasIguais && (
                <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>✓ Senhas iguais</div>
              )}
            </div>

            {retryAtivo && (
              <div style={s.alertWarning}>
                <span style={s.spinner} />
                Servidor iniciando… nova tentativa {tentativaRetry}/3
              </div>
            )}

            {erro && <div style={s.alertDanger}>{erro}</div>}

            {sucesso && (
              <div style={s.alertSuccess}>{sucesso}</div>
            )}

            <button
              type="submit"
              disabled={loading || !podeEnviar}
              title={!podeEnviar ? 'Preencha todos os campos corretamente' : ''}
              style={{
                ...s.btnPrimary,
                background: (!podeEnviar || loading) ? '#A9B6C8' : 'var(--accent)',
                cursor: (!podeEnviar || loading) ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (podeEnviar && !loading) e.currentTarget.style.background = 'var(--accent-l)'; }}
              onMouseLeave={e => { if (podeEnviar && !loading) e.currentTarget.style.background = 'var(--accent)'; }}
            >
              {loading
                ? <><span style={s.spinner} /> {retryAtivo ? 'Reconectando…' : 'Criando conta…'}</>
                : 'Criar conta'}
            </button>
          </form>

          <div style={s.footerLink}>
            Já tem conta?{' '}
            <Link to="/login" style={s.link}>Entrar</Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .login-side-panel { display: none !important; }
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
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', flexShrink: 0,
  },
  sidePanelContent: { maxWidth: 280 },
  brandMark: { ...markBase, width: 52, height: 52, borderRadius: 14, fontSize: 26, marginBottom: 24 },
  sideTitle: { fontFamily: 'var(--font-serif)', fontSize: 34, color: '#fff', lineHeight: 1.1, marginBottom: 14 },
  sideSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 32 },
  sideFeatures: { display: 'flex', flexDirection: 'column', gap: 12 },
  featureItem: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  featureDot: { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 },
  formArea: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' },
  card: {
    background: '#FFFFFF', borderRadius: 16, padding: '36px 44px', width: '100%', maxWidth: 440,
    boxShadow: '0 6px 24px rgba(11,31,58,0.10)', border: '1px solid var(--border)',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  logoMark: { ...markBase, width: 32, height: 32, borderRadius: 8, fontSize: 17 },
  logoName: { fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--primary)' },
  title: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.4px' },
  tagline: { margin: 0, fontSize: 13.5, color: 'var(--text-3)' },
  fieldGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 },
  input: {
    width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', background: '#FFFFFF', transition: 'border-color 150ms ease, box-shadow 150ms ease',
  },
  alertWarning: {
    background: 'var(--warn-bg)', border: '1px solid #F5D99A', borderRadius: 8, padding: '10px 14px',
    fontSize: 13, color: 'var(--warn)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
  },
  alertDanger: {
    background: 'var(--err-bg)', border: '1px solid #F5C6C6', color: 'var(--err)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14,
  },
  alertSuccess: {
    background: 'var(--ok-bg)', border: '1px solid #A7E0CB', color: 'var(--ok)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14,
  },
  btnPrimary: {
    width: '100%', background: 'var(--accent)', color: '#FFFFFF', border: 'none', borderRadius: 8,
    padding: '11px 20px', fontSize: 15, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 150ms ease',
  },
  spinner: {
    display: 'inline-block', width: 14, height: 14, border: '2.5px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
  },
  footerLink: { marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' },
  link: { color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' },
};
