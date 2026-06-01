import { useState, useEffect, useCallback } from 'react';
import { LogOut, Plus, Search, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CardCliente from '../components/CardCliente';
import ModalCliente from '../components/ModalCliente';
import { listarClientes, criarCliente } from '../api';

const COR_PRIMARIA = '#1A1A2E';
const COR_VERDE    = '#1D9E75';

export default function ClientesPage() {
  const { analista, logout } = useAuth();

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
    <div style={{ minHeight: '100vh', background: '#F4F4F8', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: COR_PRIMARIA, color: '#fff',
        padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>
            Conciliador Financeiro
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
            BPO Financeiro &mdash; Conciliacao automatica de cartoes
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#ccc' }}>
            Ola, <strong style={{ color: '#fff' }}>{analista?.nome}</strong>
          </span>
          <button
            onClick={logout}
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 8, padding: '7px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>

      {/* Conteudo */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* Barra de acoes */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COR_PRIMARIA }}>
            Meus Clientes
          </h1>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Campo de busca */}
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{
                position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: '#9CA3AF',
              }} />
              <input
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
                placeholder="Buscar por nome ou CNPJ..."
                style={{
                  border: '1.5px solid #D1D5DB', borderRadius: 8,
                  padding: '9px 12px 9px 32px', fontSize: 13,
                  outline: 'none', width: 240, fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Atualizar */}
            <button
              onClick={carregar}
              title="Atualizar lista"
              style={{
                background: '#fff', border: '1.5px solid #D1D5DB', borderRadius: 8,
                padding: '9px 12px', cursor: 'pointer', color: '#6B7280',
                display: 'flex', alignItems: 'center',
              }}
            >
              <RefreshCw size={15} />
            </button>

            {/* Novo cliente */}
            <button
              onClick={() => setModalAberto(true)}
              style={{
                background: COR_VERDE, color: '#fff', border: 'none',
                borderRadius: 8, padding: '9px 18px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={15} /> Novo Cliente
            </button>
          </div>
        </div>

        {/* Estados */}
        {erro && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA',
            color: '#DC2626', borderRadius: 10, padding: '14px 18px',
            fontSize: 14, marginBottom: 20,
          }}>
            {erro}
          </div>
        )}

        {carregando ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280', fontSize: 14 }}>
            <div style={{ marginBottom: 12, fontSize: 24 }}>...</div>
            Carregando clientes...
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px', color: '#9CA3AF',
            background: '#fff', borderRadius: 14, border: '1.5px dashed #D1D5DB',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
              {filtro ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
            </div>
            {!filtro && (
              <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>
                Cadastre seu primeiro cliente para comecar a conciliar
              </div>
            )}
            {!filtro && (
              <button
                onClick={() => setModalAberto(true)}
                style={{
                  background: COR_VERDE, color: '#fff', border: 'none',
                  borderRadius: 8, padding: '10px 20px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                + Novo Cliente
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20,
          }}>
            {clientesFiltrados.map(c => (
              <CardCliente key={c.id} cliente={c} />
            ))}
          </div>
        )}
      </div>

      <ModalCliente
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onSalvar={handleCriarCliente}
        clienteInicial={null}
      />
    </div>
  );
}
