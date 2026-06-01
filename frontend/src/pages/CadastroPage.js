import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registrar } from '../api';

const COR_PRIMARIA = '#1A1A2E';
const COR_VERDE    = '#1D9E75';

export default function CadastroPage() {
  const navigate = useNavigate();

  const [nome, setNome]               = useState('');
  const [email, setEmail]             = useState('');
  const [senha, setSenha]             = useState('');
  const [confirmar, setConfirmar]     = useState('');
  const [erro, setErro]               = useState('');
  const [sucesso, setSucesso]         = useState('');
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (senha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await registrar({ nome, email, senha });
      setSucesso('Conta criada com sucesso! Redirecionando para o login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Erro ao criar conta.';
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
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
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
        <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: COR_PRIMARIA }}>
          Criar conta
        </h2>

        <form onSubmit={handleSubmit}>
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

          <div style={{ marginBottom: 14 }}>
            <label style={estiloLabel}>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              placeholder="Mínimo 6 caracteres"
              style={estiloInput}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={estiloLabel}>Confirmar senha</label>
            <input
              type="password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              required
              placeholder="Repita a senha"
              style={estiloInput}
            />
          </div>

          {erro && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              marginBottom: 16,
            }}>
              {erro}
            </div>
          )}

          {sucesso && (
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#15803D',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              marginBottom: 16,
            }}>
              {sucesso}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#aaa' : COR_VERDE,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '13px',
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background .15s',
            }}
          >
            {loading ? (
              <>
                <span style={estiloSpinner} />
                Criando conta...
              </>
            ) : 'Criar conta'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#666' }}>
          Ja tem conta?{' '}
          <Link to="/login" style={{ color: COR_VERDE, fontWeight: 600, textDecoration: 'none' }}>
            Entrar
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const estiloLabel = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
};

const estiloInput = {
  width: '100%',
  border: '1.5px solid #D1D5DB',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: '#111',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const estiloSpinner = {
  display: 'inline-block',
  width: 16,
  height: 16,
  border: '2.5px solid rgba(255,255,255,0.35)',
  borderTopColor: '#fff',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};
