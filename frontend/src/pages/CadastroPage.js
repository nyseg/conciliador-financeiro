import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registrar } from '../api';

const COR_PRIMARIA = '#1A1A2E';
const COR_VERDE    = '#1D9E75';

// Regras de senha
const REGRAS = [
  { id: 'len',     label: 'Mínimo 8 caracteres',          test: s => s.length >= 8 },
  { id: 'upper',   label: 'Pelo menos uma letra maiúscula', test: s => /[A-Z]/.test(s) },
  { id: 'number',  label: 'Pelo menos um número',          test: s => /[0-9]/.test(s) },
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
            <span style={{ color: ok ? COR_VERDE : '#D1D5DB', fontSize: 14, lineHeight: 1 }}>
              {ok ? '✓' : '○'}
            </span>
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

  const senhaValida = REGRAS.every(r => r.test(senha));
  const senhasIguais = senha === confirmar && confirmar.length > 0;
  const podeEnviar = nome && email && senhaValida && senhasIguais;

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');

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
      await registrar({ nome, email, senha });
      setSucesso('Conta criada com sucesso! Redirecionando...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Erro ao criar conta. Verifique sua conexão e tente novamente.';
      setErro(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F4F8',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '24px',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: COR_PRIMARIA, letterSpacing: '-0.5px' }}>
          Conciliador Financeiro
        </div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          Crie sua conta para começar
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '36px 40px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        width: '100%',
        maxWidth: 440,
      }}>
        <h2 style={{ margin: '0 0 22px', fontSize: 20, fontWeight: 700, color: COR_PRIMARIA }}>
          Criar conta
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Nome */}
          <div style={{ marginBottom: 14 }}>
            <label style={estiloLabel}>Nome completo</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              placeholder="Seu nome"
              style={estiloInput}
            />
          </div>

          {/* E-mail */}
          <div style={{ marginBottom: 14 }}>
            <label style={estiloLabel}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              style={estiloInput}
            />
          </div>

          {/* Senha */}
          <div style={{ marginBottom: 14 }}>
            <label style={estiloLabel}>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              onFocus={() => setSenhaFocada(true)}
              required
              placeholder="Crie uma senha forte"
              style={{
                ...estiloInput,
                borderColor: senha
                  ? (senhaValida ? COR_VERDE : '#F59E0B')
                  : '#D1D5DB',
              }}
            />
            {/* Requisitos visuais — aparece ao focar ou digitar */}
            {(senhaFocada || senha) && <SenhaRequisitos senha={senha} />}
          </div>

          {/* Confirmar senha */}
          <div style={{ marginBottom: 22 }}>
            <label style={estiloLabel}>Confirmar senha</label>
            <input
              type="password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              required
              placeholder="Repita a senha"
              style={{
                ...estiloInput,
                borderColor: confirmar
                  ? (senhasIguais ? COR_VERDE : '#EF4444')
                  : '#D1D5DB',
              }}
            />
            {confirmar && !senhasIguais && (
              <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>
                As senhas não coincidem
              </div>
            )}
            {confirmar && senhasIguais && (
              <div style={{ fontSize: 12, color: COR_VERDE, marginTop: 4 }}>
                ✓ Senhas iguais
              </div>
            )}
          </div>

          {/* Erro */}
          {erro && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
            }}>
              {erro}
            </div>
          )}

          {/* Sucesso */}
          {sucesso && (
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
            }}>
              {sucesso}
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading || !podeEnviar}
            title={!podeEnviar ? 'Preencha todos os campos e atenda aos requisitos de senha' : ''}
            style={{
              width: '100%',
              background: (!podeEnviar || loading) ? '#9CA3AF' : COR_VERDE,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '13px',
              fontSize: 15,
              fontWeight: 700,
              cursor: (!podeEnviar || loading) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background .15s',
            }}
          >
            {loading ? (
              <><span style={estiloSpinner} /> Criando conta...</>
            ) : 'Criar conta'}
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

const estiloLabel = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: '#374151', marginBottom: 6,
};

const estiloInput = {
  width: '100%', border: '1.5px solid #D1D5DB', borderRadius: 8,
  padding: '10px 12px', fontSize: 14, color: '#111', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color .15s',
};

const estiloSpinner = {
  display: 'inline-block', width: 16, height: 16,
  border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
};
