import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Search, RefreshCw, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CardCliente from '../components/CardCliente';
import ModalCliente from '../components/ModalCliente';
import { listarClientes, criarCliente } from '../api';

export default function ClientesPage() {
  const { analista, logout } = useAuth();
  const navigate = useNavigate();

  const [clientes, setClientes]       = useState([]);
  const [filtro, setFiltro]           = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando]   = useState(true);
  const [erro, setErro]               = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const lista = await listarClientes();
      setClientes(lista);
    } catch (e) {
      setErro('Nao foi possivel carregar os clientes. Verifique sua conexao.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const clientesFiltrados = clientes.filter(c => {
    const q = filtro.toLowerCase();
    return (
      (c.razao_social || '').toLowerCase().includes(q) ||
      (c.nome_fantasia || '').toLowerCase().includes(q) ||
      (c.cnpj || '').includes(q)
    );
  });

  async function handleCriarCliente(dados) {
    const novo = await criarCliente(dados);
    setClientes(prev => [novo, ...prev]);
  }

  return (
    <div style={s.root}>

      {/* Header */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerIcon}>💼</span>
          <span style={s.headerLogo}>Fincil</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.headerUser}>
            {analista?.nome}
          </span>
          <button
            onClick={() => navigate('/dashboard')}
            style={s.btnIcon}
            title="Ver Dashboard"
            onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
          >
            <LayoutDashboard size={15} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Dashboard</span>
          </button>
          <button
            onClick={logout}
            style={s.btnLogout}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </header>

      {/* Conteudo */}
      <main style={s.main}>

        {/* Título + ações */}
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.pageTitle}>Clientes</h1>
            <p style={s.pageSubtitle}>Gerencie e acesse os dados de conciliação de cada cliente</p>
          </div>

          <div style={s.actionsRow}>
            {/* Busca */}
            <div style={s.searchWrapper}>
              <Search size={15} style={s.searchIcon} />
              <input
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
                placeholder="Buscar por nome ou CNPJ..."
                style={s.searchInput}
                onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Atualizar */}
            <button
              onClick={carregar}
              title="Atualizar lista"
              style={s.btnIcon}
              onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
            >
              <RefreshCw size={15} />
            </button>

            {/* Novo cliente */}
            <button
              onClick={() => setModalAberto(true)}
              style={s.btnPrimary}
              onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2563EB'; }}
            >
              <Plus size={15} />
              Novo Cliente
            </button>
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <div style={s.alertDanger}>{erro}</div>
        )}

        {/* Loading */}
        {carregando ? (
          <div style={s.emptyState}>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>Carregando clientes...</div>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>📋</div>
            <div style={s.emptyTitle}>
              {filtro ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
            </div>
            {!filtro && (
              <>
                <div style={s.emptySubtitle}>
                  Cadastre seu primeiro cliente para começar a conciliar
                </div>
                <button
                  onClick={() => setModalAberto(true)}
                  style={{ ...s.btnPrimary, marginTop: 4 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#2563EB'; }}
                >
                  <Plus size={15} /> Novo Cliente
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={s.grid}>
            {clientesFiltrados.map(c => (
              <CardCliente key={c.id} cliente={c} />
            ))}
          </div>
        )}
      </main>

      <ModalCliente
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onSalvar={handleCriarCliente}
        clienteInicial={null}
      />
    </div>
  );
}

const s = {
  root: {
    minHeight: '100vh',
    background: '#F8FAFC',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif',
  },
  header: {
    background: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    padding: '0 32px',
    height: 58,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: { fontSize: 20 },
  headerLogo: {
    fontSize: 17,
    fontWeight: 700,
    color: '#2563EB',
    letterSpacing: '-0.3px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  headerUser: {
    fontSize: 13,
    color: '#475569',
    fontWeight: 500,
  },
  btnLogout: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    color: '#475569',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 150ms ease',
  },
  main: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '32px 24px',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 28,
    flexWrap: 'wrap',
    gap: 16,
  },
  pageTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#0F172A',
    letterSpacing: '-0.4px',
  },
  pageSubtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: '#94A3B8',
  },
  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  searchWrapper: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94A3B8',
    pointerEvents: 'none',
  },
  searchInput: {
    border: '1.5px solid #E2E8F0',
    borderRadius: 8,
    padding: '9px 12px 9px 34px',
    fontSize: 13,
    outline: 'none',
    width: 240,
    fontFamily: 'inherit',
    color: '#0F172A',
    background: '#FFFFFF',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  },
  btnIcon: {
    background: '#FFFFFF',
    border: '1.5px solid #E2E8F0',
    borderRadius: 8,
    padding: '9px 12px',
    cursor: 'pointer',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 150ms ease',
  },
  btnPrimary: {
    background: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 150ms ease',
  },
  alertDanger: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    borderRadius: 10,
    padding: '14px 18px',
    fontSize: 14,
    marginBottom: 20,
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 24px',
    background: '#FFFFFF',
    borderRadius: 12,
    border: '1.5px dashed #E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#475569',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 20,
  },
};
