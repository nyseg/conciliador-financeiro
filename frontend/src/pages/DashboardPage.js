import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, TrendingDown, RefreshCw, Users } from 'lucide-react';
import { listarClientes, listarConciliacoes } from '../api';

function TaxaBar({ taxa }) {
  const cor = taxa >= 80 ? '#0A7B5C' : taxa >= 50 ? '#8A5A00' : '#B83232';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 64, height: 6, background: '#E8E8EE', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${taxa}%`, height: '100%', background: cor, borderRadius: 3, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: cor }}>{taxa}%</span>
    </div>
  );
}

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarPeriodo(periodo) {
  if (!periodo) return '—';
  const [ano, mes] = periodo.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(mes) - 1]}/${ano}`;
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [clientes, setClientes] = useState([]);
  const [historico, setHistorico] = useState([]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const lista = await listarClientes();
      setClientes(lista);

      const todas = [];
      await Promise.all(lista.map(async (c) => {
        try {
          const concs = await listarConciliacoes(c.id);
          concs.forEach(h => todas.push({
            ...h,
            cliente_nome: c.nome_fantasia || c.razao_social,
            cliente_id: c.id,
          }));
        } catch {
          // cliente sem conciliações ou erro isolado — continua
        }
      }));

      todas.sort((a, b) => new Date(b.data_execucao) - new Date(a.data_execucao));
      setHistorico(todas);
    } catch {
      setErro('Não foi possível carregar os dados. Verifique sua conexão.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const total = historico.length;
  const taxaMedia = total === 0 ? 0 : Math.round(
    historico.reduce((acc, h) => {
      const t = h.total_itens || 0;
      const c = h.conciliados || 0;
      return acc + (t > 0 ? (c / t) * 100 : 0);
    }, 0) / total
  );
  const qtdDespesas = historico.filter(h => h.tipo === 'despesas').length;
  const qtdReceitas = historico.filter(h => h.tipo === 'receitas').length;
  const ultima = historico[0];

  const corTaxa = taxaMedia >= 80 ? '#0A7B5C' : taxaMedia >= 50 ? '#8A5A00' : '#B83232';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 200ms ease' }}>

        {/* Título */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={s.pageTitle}>
            <LayoutDashboard size={20} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--primary)' }} />
            Dashboard
          </h1>
          <p style={s.pageSubtitle}>Visão consolidada de todos os clientes e conciliações</p>
        </div>

        {carregando ? (
          <div style={s.emptyState}>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>Carregando dados...</div>
          </div>
        ) : erro ? (
          <div style={s.alertDanger}>{erro}</div>
        ) : (
          <>
            {/* Cards de métricas */}
            <div style={s.metricsGrid}>
              {[
                { label: 'Total de execuções', value: total,          color: '#378ADD', Icon: RefreshCw  },
                { label: 'Taxa média conciliada', value: `${taxaMedia}%`, color: corTaxa, Icon: null    },
                { label: 'Clientes',             value: clientes.length, color: '#7C3AED', Icon: Users  },
                { label: 'Despesas',             value: qtdDespesas,  color: '#B83232', Icon: TrendingDown },
                { label: 'Receitas',             value: qtdReceitas,  color: '#0A7B5C', Icon: TrendingUp   },
              ].map(({ label, value, color, Icon }) => (
                <div key={label} style={s.metricCard}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {Icon && <Icon size={12} />} {label}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Última execução destaque */}
            {ultima && (
              <div style={s.lastExec}>
                <span style={{ fontWeight: 600, color: '#1A5FA8' }}>Última conciliação: </span>
                <span style={{ color: '#333' }}>
                  <span
                    style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}
                    onClick={() => navigate(`/clientes/${ultima.cliente_id}`)}
                  >
                    {ultima.cliente_nome}
                  </span>
                  {' — '}{ultima.tipo === 'despesas' ? 'Despesas' : 'Receitas'}
                  {' — '}{ultima.conciliados}/{ultima.total_itens} itens conciliados
                  {ultima.periodo ? ` — ${formatarPeriodo(ultima.periodo)}` : ''}
                  {' — '}{formatarData(ultima.data_execucao)}
                </span>
              </div>
            )}

            {/* Tabela histórico */}
            {total === 0 ? (
              <div style={{ ...s.emptyState, marginTop: 0 }}>
                <LayoutDashboard size={40} style={{ marginBottom: 12, opacity: 0.3, color: '#94A3B8' }} />
                <div style={{ fontSize: 14, color: '#94A3B8' }}>Nenhuma conciliação realizada ainda.</div>
                <div style={{ fontSize: 12, marginTop: 4, color: '#CBD5E1' }}>
                  Execute uma conciliação na página de cada cliente para registrar aqui.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Data/Hora', 'Cliente', 'Tipo', 'Período', 'Total', 'Conciliados', 'Taxa'].map(col => (
                        <th key={col} style={s.th}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((h, i) => {
                      const total_itens = h.total_itens || 0;
                      const conciliados = h.conciliados || 0;
                      const taxa = total_itens > 0 ? Math.round((conciliados / total_itens) * 100) : 0;
                      return (
                        <tr
                          key={h.id}
                          style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', cursor: 'pointer', transition: 'background 100ms' }}
                          onClick={() => navigate(`/clientes/${h.cliente_id}`)}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--ice)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAFA'; }}
                        >
                          <td style={s.td}>{formatarData(h.data_execucao)}</td>
                          <td style={{ ...s.td, fontWeight: 500, color: 'var(--primary)' }}>{h.cliente_nome}</td>
                          <td style={s.td}>
                            <span style={{
                              background: h.tipo === 'despesas' ? '#FDECEA' : '#E5F5EF',
                              color: h.tipo === 'despesas' ? '#B83232' : '#0A7B5C',
                              borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700,
                            }}>
                              {h.tipo === 'despesas' ? 'Despesas' : 'Receitas'}
                            </span>
                          </td>
                          <td style={s.td}>{formatarPeriodo(h.periodo)}</td>
                          <td style={{ ...s.td, fontWeight: 600 }}>{total_itens}</td>
                          <td style={{ ...s.td, fontWeight: 600, color: '#0A7B5C' }}>{conciliados}</td>
                          <td style={s.td}><TaxaBar taxa={taxa} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
    </div>
  );
}

const s = {
  root: {
    minHeight: '100vh',
    background: '#F8FAFC',
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
    color: 'var(--primary)',
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
  main: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '32px 24px',
  },
  pageTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#0F172A',
    letterSpacing: '-0.4px',
    display: 'flex',
    alignItems: 'center',
  },
  pageSubtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: '#94A3B8',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 14,
    marginBottom: 24,
  },
  metricCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    padding: '16px 18px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  lastExec: {
    background: 'var(--ice)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 16px',
    marginBottom: 20,
    fontSize: 13,
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
    gap: 4,
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
  th: {
    padding: '10px 14px',
    background: '#F5F5FA',
    fontWeight: 600,
    fontSize: 11,
    color: '#555',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #E2E8F0',
  },
  td: {
    padding: '8px 14px',
    whiteSpace: 'nowrap',
    color: '#555',
    borderBottom: '1px solid #F1F5F9',
  },
};
