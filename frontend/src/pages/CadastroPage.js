import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registrar } from '../api';
import { apiComRetry } from '../utils/apiComRetry';

const COR_PRIMARIA = '#1A1A2E';
const COR_VERDE    = '#1D9E75';

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
            <span style={{ color: ok ? COR_VERDE : '#D1D5DB', fontSize: 14 }}>{ok ? '✓' : '○'}</span>
            <span style={{ color: ok ? '#374151' : '#9CA3AF' }}>{r.label}</span>
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
        (tent, max) => setTentativaRetry(tent),
      );
      setSucesso('Conta criada com sucesso! Redirecionando...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      if (err.ehTimeoutServidor) {
        setErro('⏱ O servidor demorou para responder. Clique em "Criar conta" novamente — agora será imediato.');
      } else {
        setErro(err.response?.data?.detail || err.message || 'Erro ao criar conta.');
      }
    } finally {
      setLoading(false);
      setTentativaRetry(0);
    }
  }

  const retryAtivo = loading && tentativaRetry > 0;

  return (
    <div style={{
      minHeight: '100vh', background: '#F4F4F8',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', padding: '24px',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: COR_PRIMARIA, letterSpacing: '-0.5px' }}>
          Conciliador Financeiro
        </div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Crie sua conta para começar</div>
      </div>

      {/* Card */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '36px 40px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', width: '100%', maxWidth: 440,
      }}>
        <h2 style={{ margin: '0 0 22px', fontSize: 20, fontWeight: 700, color: COR_PRIMARIA }}>
          Criar conta
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={estiloLabel}>Nome completo</label>
            <input value={nome} onChange={e => setNome(e.target.value)}
              required placeholder="Seu nome" style={estiloInput} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={estiloLabel}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="seu@email.com" style={estiloInput} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={estiloLabel}>Senha</label>
            <input type="password" value={senha}
              onChange={e => setSenha(e.target.value)}
              onFocus={() => setSenhaFocada(true)}
              required placeholder="Crie uma senha forte"
              style={{ ...estiloInput, borderColor: senha ? (senhaValida ? COR_VERDE : '#F59E0B') : '#D1D5DB' }} />
            {(senhaFocada || senha) && <SenhaRequisitos senha={senha} />}
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={estiloLabel}>Confirmar senha</label>
            <input type="password" value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              required placeholder="Repita a senha"
              style={{ ...estiloInput, borderColor: confirmar ? (senhasIguais ? COR_VERDE : '#EF4444') : '#D1D5DB' }} />
            {confirmar && !senhasIguais && (
              <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>As senhas não coincidem</div>
            )}
            {confirmar && senhasIguais && (
              <div style={{ fontSize: 12, color: COR_VERDE, marginTop: 4 }}>✓ Senhas iguais</div>
            )}
          </div>

          {/* Retry em andamento */}
          {retryAtivo && (
            <div style={{ background: '#FEF3E2', border: '1px solid #F5D99A', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, color: '#7A4500', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={estiloSpinner} />
              ☕ Servidor iniciando… nova tentativa {tentativaRetry}/3
            </div>
          )}

          {erro && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              {erro}
            </div>
          )}

          {sucesso && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              {sucesso}
            </div>
          )}

          <button type="submit" disabled={loading || !podeEnviar}
            title={!podeEnviar ? 'Preencha todos os campos corretamente' : ''}
            style={{
              width: '100%',
              background: (!podeEnviar || loading) ? '#9CA3AF' : COR_VERDE,
              color: '#fff', border: 'none', borderRadius: 10, padding: '13px',
              fontSize: 15, fontWeight: 700,
              cursor: (!podeEnviar || loading) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {loading
              ? <><span style={estiloSpinner} /> {retryAtivo ? 'Reconectando…' : 'Criando conta…'}</>
              : 'Criar conta'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#666' }}>
          Já tem conta?{' '}
          <Link to="/login" style={{ color: COR_VERDE, fontWeight: 600, textDecoration: 'none' }}>
            Entrar
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
  boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color .15s' };
const estiloSpinner = { display: 'inline-block', width: 14, height: 14,
  border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 };
