import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw } from 'lucide-react';
import CardCliente from '../components/CardCliente';
import ModalCliente from '../components/ModalCliente';
import { listarClientes, criarCliente } from '../api';

export default function ClientesPage() {
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
      setErro('Não foi possível carregar os clientes. Verifique sua conexão.');
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
    <div style={{ maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 200ms ease' }}>

      {/* Título + ações */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Clientes</h1>
          <p style={s.pageSubtitle}>Gerencie e acesse os dados de conciliação de cada cliente</p>
        </div>

        <div style={s.actionsRow}>
          <div style={s.searchWrapper}>
            <Search size={15} style={s.searchIcon} />
            <input
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              placeholder="Buscar por nome ou CNPJ..."
              style={s.searchInput}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(26,68,128,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <button
            onClick={carregar}
            title="Atualizar lista"
            style={s.btnIcon}
            onMouseEnter={e => { e.currentTarget.style.background = '#F0F4F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
          >
            <RefreshCw size={15} />
          </button>

          <button
            onClick={() => setModalAberto(true)}
            style={s.btnPrimary}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-l)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; }}
          >
            <Plus size={15} />
            Novo Cliente
          </button>
        </div>
      </div>

      {erro && <div style={s.alertDanger}>{erro}</div>}

      {carregando ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Carregando clientes...</div>
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
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-l)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; }}
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
  pageHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 24, flexWrap: 'wrap', gap: 16,
  },
  pageTitle: {
    margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.4px',
  },
  pageSubtitle: { margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-3)' },
  actionsRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  searchWrapper: { position: 'relative' },
  searchIcon: {
    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-3)', pointerEvents: 'none',
  },
  searchInput: {
    border: '1.5px solid var(--border)', borderRadius: 8,
    padding: '9px 12px 9px 34px', fontSize: 13, outline: 'none', width: 240,
    fontFamily: 'inherit', color: 'var(--text-1)', background: '#FFFFFF',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  },
  btnIcon: {
    background: '#FFFFFF', border: '1.5px solid var(--border)', borderRadius: 8,
    padding: '9px 12px', cursor: 'pointer', color: 'var(--text-2)',
    display: 'flex', alignItems: 'center', transition: 'all 150ms ease',
  },
  btnPrimary: {
    background: 'var(--accent)', color: '#FFFFFF', border: 'none', borderRadius: 8,
    padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6, transition: 'background 150ms ease',
  },
  alertDanger: {
    background: 'var(--err-bg)', border: '1px solid #F5C6C6', color: 'var(--err)',
    borderRadius: 10, padding: '14px 18px', fontSize: 14, marginBottom: 20,
  },
  emptyState: {
    textAlign: 'center', padding: '60px 24px', background: '#FFFFFF',
    borderRadius: 12, border: '1.5px dashed var(--border)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--text-2)' },
  emptySubtitle: { fontSize: 13, color: 'var(--text-3)' },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20,
  },
};
