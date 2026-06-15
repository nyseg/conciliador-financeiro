import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingDown, TrendingUp, History, Settings, Download, Eye } from 'lucide-react';
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
  const [lista, setLista]             = useState([]);
  const [carregando, setCarregando]   = useState(true);
  const [detalhe, setDetalhe]         = useState(null);
  const [loadDetalhe, setLoadDetalhe] = useState(null);
  const [loadExport, setLoadExport]   = useState(null);

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

  if (carregando) return <p style={{ color: '#94A3B8', fontSize: 14 }}>Carregando historico...</p>;

  if (lista.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
      <div style={{ fontSize: 14 }}>Nenhuma conciliação realizada ainda para este cliente.</div>
    </div>
  );

  return (
    <div>
      <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 20 }}>
        Histórico de Conciliações
      </h3>
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Período', 'Tipo', 'Data execução', 'Total', 'Conciliados', 'Pendentes', 'Diferença', 'Ações'].map(h => (
                <th key={h} style={s.thCell}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((c, i) => (
              <tr
                key={c.id}
                style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#FFFFFF' : '#FAFAFA'}
              >
                <td style={s.tdCell}><span style={{ fontWeight: 600, color: '#0F172A' }}>{c.periodo || '-'}</span></td>
                <td style={s.tdCell}><span style={{ textTransform: 'capitalize', color: '#475569' }}>{c.tipo}</span></td>
                <td style={s.tdCell}><span style={{ color: '#475569' }}>{formatarData(c.criado_em)}</span></td>
                <td style={s.tdCell}><span style={{ color: '#0F172A', fontWeight: 500 }}>{formatarMoeda(c.total_fatura)}</span></td>
                <td style={s.tdCell}>
                  <span style={s.badgeSuccess}>{c.conciliados}</span>
                </td>
                <td style={s.tdCell}>
                  <span style={s.badgeDanger}>{c.pendentes}</span>
                </td>
                <td style={s.tdCell}>
                  <span style={{ color: Number(c.diferenca) > 0 ? '#DC2626' : '#059669', fontWeight: 600 }}>
                    {formatarMoeda(c.diferenca)}
                  </span>
                </td>
                <td style={s.tdCell}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => verDetalhe(c.id)}
                      disabled={loadDetalhe === c.id}
                      title="Ver detalhes"
                      style={s.btnIconTable}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => baixarExcel(c.id)}
                      disabled={loadExport === c.id}
                      title="Baixar Excel"
                      style={{ ...s.btnIconTable, background: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }}
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
        <div
          style={s.modalOverlay}
          onClick={e => { if (e.target === e.currentTarget) setDetalhe(null); }}
        >
          <div style={s.modalBox}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>
                Detalhes — {detalhe.tipo} {detalhe.periodo}
              </h3>
              <button onClick={() => setDetalhe(null)} style={s.modalClose}>&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
              <StatCard label="Total Fatura"  valor={formatarMoeda(detalhe.total_fatura)} />
              <StatCard label="Total ERP"     valor={formatarMoeda(detalhe.total_erp)} />
              <StatCard label="Diferença"     valor={formatarMoeda(detalhe.diferenca)} />
              <StatCard label="Conciliados"   valor={detalhe.conciliados} cor="#059669" />
              <StatCard label="Pendentes"     valor={detalhe.pendentes} cor="#DC2626" />
              <StatCard label="Total Itens"   valor={detalhe.total_itens} />
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>
              Executado em {formatarData(detalhe.criado_em)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, valor, cor }) {
  return (
    <div style={{
      background: '#F8FAFC',
      borderRadius: 10,
      padding: '14px 16px',
      border: '1px solid #E2E8F0',
    }}>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor || '#0F172A' }}>{valor}</div>
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

  if (!perfil) return <p style={{ color: '#94A3B8', fontSize: 14 }}>Carregando configuracoes...</p>;

  return (
    <div style={{ maxWidth: 600 }}>
      <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 20 }}>
        Configurações do Cliente
      </h3>
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
            padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
            background: msg.includes('sucesso') ? '#ECFDF5' : '#FEF2F2',
            color: msg.includes('sucesso') ? '#059669' : '#DC2626',
            border: `1px solid ${msg.includes('sucesso') ? '#A7F3D0' : '#FECACA'}`,
          }}>
            {msg}
          </div>
        )}

        <button
          type="submit"
          disabled={salvando}
          style={{
            background: salvando ? '#94A3B8' : '#2563EB',
            color: '#fff', border: 'none', borderRadius: 8, padding: '11px 24px',
            fontSize: 14, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer',
            transition: 'background 150ms ease',
          }}
          onMouseEnter={e => { if (!salvando) e.currentTarget.style.background = '#1D4ED8'; }}
          onMouseLeave={e => { if (!salvando) e.currentTarget.style.background = '#2563EB'; }}
        >
          {salvando ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </form>
    </div>
  );
}

function CampoConfig({ label, value, onChange, tipo = 'text', opcoes }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 6 }}>
        {label}
      </label>
      {tipo === 'select' ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={s.configInput}
        >
          {(opcoes || []).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : (
        <input
          type={tipo}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={s.configInput}
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

  const [cliente, setCliente]         = useState(null);
  const [aba, setAba]                 = useState('despesas');
  const [processando, setProcessando] = useState(null);

  useEffect(() => {
    obterCliente(id)
      .then(setCliente)
      .catch(() => navigate('/clientes'));
  }, [id, navigate]);

  if (!cliente) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', color: '#94A3B8', fontSize: 14 }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 200ms ease' }}>

      {/* Cabeçalho da página */}
      <div style={s.pageHead}>
        <button
          onClick={() => navigate('/clientes')}
          style={s.btnBack}
          onMouseEnter={e => { e.currentTarget.style.background = '#F0F4F9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
        >
          <ArrowLeft size={14} /> Clientes
        </button>
        <div>
          <h1 style={s.pageTitle}>{cliente.nome_fantasia || cliente.razao_social}</h1>
          {cliente.razao_social && cliente.nome_fantasia && (
            <p style={s.pageSub}>{cliente.razao_social}</p>
          )}
        </div>
      </div>

      {/* Banner de processamento */}
      {processando && (
        <div style={s.banner} className="resp-banner">
          <div style={s.bannerSpinner} />
          <span>
            <strong>Conciliação de {processando === 'despesas' ? 'Despesas' : 'Receitas'} em andamento...</strong>
            {' '}Você pode navegar entre as abas.
          </span>
          <button
            onClick={() => setAba(processando)}
            style={s.bannerBtn}
          >
            Ver progresso &rarr;
          </button>
        </div>
      )}

      {/* Abas */}
      <nav style={s.tabs} className="resp-tabs">
        {ABAS.map(({ key, label, icon: Icon }) => {
          const ativa = aba === key;
          return (
            <button
              key={key}
              onClick={() => setAba(key)}
              style={{
                ...s.tabBtn,
                color: ativa ? 'var(--primary)' : 'var(--text-3)',
                borderBottom: ativa ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: ativa ? 600 : 400,
              }}
              onMouseEnter={e => { if (!ativa) e.currentTarget.style.color = 'var(--text-2)'; }}
              onMouseLeave={e => { if (!ativa) e.currentTarget.style.color = 'var(--text-3)'; }}
            >
              <Icon size={15} /> {label}
              {processando === key && (
                <span style={s.processingDot} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Conteudo */}
      <div style={s.content} className="resp-content">
        <div style={s.contentCard} className="resp-card">
          <div style={{ display: aba === 'despesas' ? 'block' : 'none' }}>
            <DespesasPage setProcessando={setProcessando} clienteId={id} />
          </div>
          <div style={{ display: aba === 'receitas' ? 'block' : 'none' }}>
            <ReceitasPage setProcessando={setProcessando} clienteId={id} />
          </div>
          {aba === 'historico' && <AbaHistorico clienteId={id} />}
          {aba === 'config'    && <AbaConfiguracoes clienteId={id} />}
        </div>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

const s = {
  pageHead: {
    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18,
  },
  pageTitle: {
    margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.3px',
  },
  pageSub: { margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-3)' },
  root: {
    minHeight: '100vh',
    background: '#F8FAFC',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif',
  },
  header: {
    background: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    padding: '14px 32px',
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
    gap: 16,
  },
  btnBack: {
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
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
  },
  breadcrumbBase: {
    color: '#94A3B8',
  },
  breadcrumbSep: {
    color: '#CBD5E1',
  },
  breadcrumbCurrent: {
    color: '#0F172A',
    fontWeight: 600,
  },
  headerUser: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: 500,
  },
  banner: {
    background: '#2563EB',
    color: '#fff',
    padding: '10px 32px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
  },
  bannerSpinner: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '2.5px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  bannerBtn: {
    marginLeft: 'auto',
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#fff',
    borderRadius: 6,
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  tabs: {
    background: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    padding: '0 32px',
    display: 'flex',
    gap: 0,
  },
  tabBtn: {
    padding: '14px 20px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    transition: 'color 150ms ease, border-color 150ms ease',
    position: 'relative',
    fontFamily: 'inherit',
    marginBottom: -1,
  },
  processingDot: {
    width: 7,
    height: 7,
    background: '#2563EB',
    borderRadius: '50%',
    position: 'absolute',
    top: 8,
    right: 6,
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  content: {
    maxWidth: 980,
    margin: '0 auto',
    padding: '28px 24px',
  },
  contentCard: {
    background: '#FFFFFF',
    borderRadius: 12,
    padding: '28px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    border: '1px solid #E2E8F0',
  },
  thCell: {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  tdCell: {
    padding: '10px 12px',
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  badgeSuccess: {
    background: '#ECFDF5',
    color: '#059669',
    borderRadius: 20,
    padding: '2px 10px',
    fontWeight: 700,
    fontSize: 12,
  },
  badgeDanger: {
    background: '#FEF2F2',
    color: '#DC2626',
    borderRadius: 20,
    padding: '2px 10px',
    fontWeight: 700,
    fontSize: 12,
  },
  btnIconTable: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    padding: '5px 8px',
    cursor: 'pointer',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 150ms ease',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modalBox: {
    background: '#FFFFFF',
    borderRadius: 16,
    padding: '28px 32px',
    width: '100%',
    maxWidth: 700,
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    border: '1px solid #E2E8F0',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid #E2E8F0',
  },
  modalTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#0F172A',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    cursor: 'pointer',
    color: '#94A3B8',
    lineHeight: 1,
    padding: 0,
    transition: 'color 150ms ease',
  },
  configInput: {
    width: '100%',
    border: '1.5px solid #E2E8F0',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 14,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    color: '#0F172A',
    background: '#FFFFFF',
    outline: 'none',
  },
};
