import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingDown, TrendingUp, History, Settings, Download, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DespesasPage from './DespesasPage';
import ReceitasPage from './ReceitasPage';
import {
  obterCliente,
  listarConciliacoes,
  detalharConciliacao,
  reexportarConciliacao,
  carregarPerfilCliente,
  salvarPerfilCliente,
} from '../api';

const COR_PRIMARIA = '#1A1A2E';
const COR_VERDE    = '#1D9E75';

const ABAS = [
  { key: 'despesas',  label: 'Despesas',      icon: TrendingDown },
  { key: 'receitas',  label: 'Receitas',       icon: TrendingUp },
  { key: 'historico', label: 'Historico',      icon: History },
  { key: 'config',    label: 'Configuracoes',  icon: Settings },
];

function formatarData(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ---------------------------------------------------------------------------
// Aba Historico
// ---------------------------------------------------------------------------
function AbaHistorico({ clienteId }) {
  const [lista, setLista]         = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [detalhe, setDetalhe]     = useState(null);
  const [loadDetalhe, setLoadDetalhe] = useState(null);
  const [loadExport, setLoadExport] = useState(null);

  useEffect(() => {
    listarConciliacoes(clienteId)
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => setCarregando(false));
  }, [clienteId]);

  async function verDetalhe(id) {
    setLoadDetalhe(id);
    try {
      const d = await detalharConciliacao(id);
      setDetalhe(d);
    } catch {
      alert('Nao foi possivel carregar os detalhes.');
    } finally {
      setLoadDetalhe(null);
    }
  }

  async function baixarExcel(id) {
    setLoadExport(id);
    try {
      await reexportarConciliacao(id);
    } catch {
      alert('Nao foi possivel exportar o Excel.');
    } finally {
      setLoadExport(null);
    }
  }

  if (carregando) return <p style={{ color: '#6B7280' }}>Carregando historico...</p>;

  if (lista.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
      <div>Nenhuma conciliacao realizada ainda para este cliente.</div>
    </div>
  );

  return (
    <div>
      <h3 style={{ marginTop: 0, color: COR_PRIMARIA }}>Historico de Conciliacoes</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
              {['Periodo', 'Tipo', 'Data execucao', 'Total', 'Conciliados', 'Pendentes', 'Diferenca', 'Acoes'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.periodo || '-'}</td>
                <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>{c.tipo}</td>
                <td style={{ padding: '10px 12px' }}>{formatarData(c.criado_em)}</td>
                <td style={{ padding: '10px 12px' }}>{formatarMoeda(c.total_fatura)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ background: '#F0FDF4', color: '#16A34A', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>
                    {c.conciliados}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>
                    {c.pendentes}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: Number(c.diferenca) > 0 ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                  {formatarMoeda(c.diferenca)}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => verDetalhe(c.id)}
                      disabled={loadDetalhe === c.id}
                      title="Ver detalhes"
                      style={estiloBtnIcone}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => baixarExcel(c.id)}
                      disabled={loadExport === c.id}
                      title="Baixar Excel"
                      style={{ ...estiloBtnIcone, background: '#F0FDF4', color: '#16A34A' }}
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de detalhe */}
      {detalhe && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 24,
        }}
          onClick={e => { if (e.target === e.currentTarget) setDetalhe(null); }}
        >
          <div style={{
            background: '#fff', borderRadius: 16, padding: '28px 32px',
            width: '100%', maxWidth: 700, maxHeight: '80vh',
            overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: COR_PRIMARIA }}>
                Detalhes — {detalhe.tipo} {detalhe.periodo}
              </h3>
              <button onClick={() => setDetalhe(null)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280',
              }}>&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <Stat label="Total Fatura" valor={formatarMoeda(detalhe.total_fatura)} />
              <Stat label="Total ERP" valor={formatarMoeda(detalhe.total_erp)} />
              <Stat label="Diferenca" valor={formatarMoeda(detalhe.diferenca)} />
              <Stat label="Conciliados" valor={detalhe.conciliados} cor="#16A34A" />
              <Stat label="Pendentes" valor={detalhe.pendentes} cor="#DC2626" />
              <Stat label="Total Itens" valor={detalhe.total_itens} />
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
              Executado em {formatarData(detalhe.criado_em)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, valor, cor }) {
  return (
    <div style={{
      background: '#F9FAFB', borderRadius: 10, padding: '12px 16px',
    }}>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: cor || COR_PRIMARIA }}>{valor}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Configuracoes
// ---------------------------------------------------------------------------
function AbaConfiguracoes({ clienteId }) {
  const [perfil, setPerfil]     = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    carregarPerfilCliente(clienteId)
      .then(setPerfil)
      .catch(() => setPerfil({}));
  }, [clienteId]);

  function set(campo, valor) {
    setPerfil(p => ({ ...p, [campo]: valor }));
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setMsg('');
    try {
      await salvarPerfilCliente(clienteId, {
        cenario_parcelamento:  perfil.cenario_parcelamento  || 'B',
        campo_numero_fatura:   perfil.campo_numero_fatura   || '',
        campo_forma_pagamento: perfil.campo_forma_pagamento || '',
        valor_forma_pagamento: perfil.valor_forma_pagamento || '',
        tolerancia_dias:       Number(perfil.tolerancia_dias) || 5,
        campo_parcelas_erp:    perfil.campo_parcelas_erp    || '',
        mapeamento_colunas:    perfil.mapeamento_colunas    || {},
      });
      setMsg('Configuracoes salvas com sucesso!');
    } catch {
      setMsg('Erro ao salvar configuracoes.');
    } finally {
      setSalvando(false);
    }
  }

  if (!perfil) return <p style={{ color: '#6B7280' }}>Carregando configuracoes...</p>;

  return (
    <div style={{ maxWidth: 600 }}>
      <h3 style={{ marginTop: 0, color: COR_PRIMARIA }}>Configuracoes do Cliente</h3>
      <form onSubmit={salvar}>
        <CampoConfig
          label="Cenario de Parcelamento"
          value={perfil.cenario_parcelamento || 'B'}
          onChange={v => set('cenario_parcelamento', v)}
          tipo="select"
          opcoes={[{ v: 'A', l: 'A — Parcelas no ERP' }, { v: 'B', l: 'B — Total na fatura' }]}
        />
        <CampoConfig label="Campo Numero Fatura (ERP)" value={perfil.campo_numero_fatura || ''} onChange={v => set('campo_numero_fatura', v)} />
        <CampoConfig label="Campo Forma de Pagamento" value={perfil.campo_forma_pagamento || ''} onChange={v => set('campo_forma_pagamento', v)} />
        <CampoConfig label="Valor Forma de Pagamento" value={perfil.valor_forma_pagamento || ''} onChange={v => set('valor_forma_pagamento', v)} />
        <CampoConfig label="Tolerancia de Dias" value={perfil.tolerancia_dias ?? 5} onChange={v => set('tolerancia_dias', v)} tipo="number" />
        <CampoConfig label="Campo Parcelas ERP" value={perfil.campo_parcelas_erp || ''} onChange={v => set('campo_parcelas_erp', v)} />

        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12,
            background: msg.includes('sucesso') ? '#F0FDF4' : '#FEF2F2',
            color: msg.includes('sucesso') ? '#15803D' : '#DC2626',
            border: `1px solid ${msg.includes('sucesso') ? '#BBF7D0' : '#FECACA'}`,
          }}>
            {msg}
          </div>
        )}

        <button
          type="submit"
          disabled={salvando}
          style={{
            background: salvando ? '#aaa' : COR_VERDE, color: '#fff',
            border: 'none', borderRadius: 8, padding: '11px 24px',
            fontSize: 14, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer',
          }}
        >
          {salvando ? 'Salvando...' : 'Salvar Configuracoes'}
        </button>
      </form>
    </div>
  );
}

function CampoConfig({ label, value, onChange, tipo = 'text', opcoes }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {label}
      </label>
      {tipo === 'select' ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: '100%', border: '1.5px solid #D1D5DB', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit' }}
        >
          {(opcoes || []).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : (
        <input
          type={tipo}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: '100%', border: '1.5px solid #D1D5DB', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagina principal do cliente
// ---------------------------------------------------------------------------
export default function ClientePage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { analista } = useAuth();

  const [cliente, setCliente]     = useState(null);
  const [aba, setAba]             = useState('despesas');
  const [processando, setProcessando] = useState(null);

  useEffect(() => {
    obterCliente(id)
      .then(setCliente)
      .catch(() => navigate('/clientes'));
  }, [id, navigate]);

  if (!cliente) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F4F8', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: COR_PRIMARIA, color: '#fff',
        padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/clientes')}
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 8, padding: '7px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <ArrowLeft size={14} /> Clientes
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>
              {cliente.nome_fantasia || cliente.razao_social}
            </div>
            {cliente.nome_fantasia && (
              <div style={{ fontSize: 11, color: '#aaa' }}>{cliente.razao_social}</div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#ccc' }}>
          {analista?.nome}
        </div>
      </div>

      {/* Banner de processamento */}
      {processando && (
        <div style={{
          background: '#1A5FA8', color: '#fff',
          padding: '9px 32px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
            animation: 'spin 0.8s linear infinite', flexShrink: 0,
          }} />
          <span>
            <strong>Conciliacao de {processando === 'despesas' ? 'Despesas' : 'Receitas'} em andamento...</strong>
            {' '}Voce pode navegar entre as abas.
          </span>
          <button
            onClick={() => setAba(processando)}
            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Ver progresso &rarr;
          </button>
        </div>
      )}

      {/* Abas */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 32px', display: 'flex', gap: 0 }}>
        {ABAS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setAba(key)}
            style={{
              padding: '13px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: aba === key ? 700 : 400, fontSize: 14,
              color: aba === key ? COR_PRIMARIA : '#888',
              borderBottom: aba === key ? `2.5px solid ${COR_PRIMARIA}` : '2.5px solid transparent',
              display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s',
              position: 'relative', fontFamily: 'inherit',
            }}>
            <Icon size={15} /> {label}
            {processando === key && (
              <span style={{
                width: 7, height: 7, background: '#3B9EFF', borderRadius: '50%',
                position: 'absolute', top: 8, right: 6,
                animation: 'pulse 1.2s ease-in-out infinite',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Conteudo */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: aba === 'despesas' ? 'block' : 'none' }}>
            <DespesasPage setProcessando={setProcessando} clienteId={id} />
          </div>
          <div style={{ display: aba === 'receitas' ? 'block' : 'none' }}>
            <ReceitasPage setProcessando={setProcessando} clienteId={id} />
          </div>
          {aba === 'historico' && <AbaHistorico clienteId={id} />}
          {aba === 'config' && <AbaConfiguracoes clienteId={id} />}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

const estiloBtnIcone = {
  background: '#F3F4F6',
  border: '1px solid #E5E7EB',
  borderRadius: 6,
  padding: '5px 8px',
  cursor: 'pointer',
  color: '#374151',
  display: 'flex',
  alignItems: 'center',
};
