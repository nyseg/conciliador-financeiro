import { useState, useEffect } from 'react';
import { LayoutDashboard, Trash2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { listarHistorico, removerEntrada, limparHistorico } from '../utils/historico';

function TaxaBar({ taxa }) {
  const cor = taxa >= 80 ? '#1D9E75' : taxa >= 50 ? '#BA7517' : '#E24B4A';
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
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    setHistorico(listarHistorico());
  }, []);

  function handleRemover(id) {
    removerEntrada(id);
    setHistorico(listarHistorico());
  }

  function handleLimpar() {
    if (window.confirm('Apagar todo o histórico de conciliações?')) {
      limparHistorico();
      setHistorico([]);
    }
  }

  // Métricas agregadas
  const total = historico.length;
  const taxaMedia = total === 0 ? 0 : Math.round(
    historico.reduce((acc, h) => {
      const r = h.resumo || {};
      const t = r.total_itens || 0;
      const c = r.conciliados || 0;
      return acc + (t > 0 ? (c / t) * 100 : 0);
    }, 0) / total
  );
  const ultima = historico[0];

  // Totais por tipo
  const qtdDespesas = historico.filter(h => h.tipo === 'despesas').length;
  const qtdReceitas = historico.filter(h => h.tipo === 'receitas').length;

  return (
    <div>
      <div className="resp-dash-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutDashboard size={17} /> Dashboard
          </h2>
          <p style={{ fontSize: 13, color: '#666' }}>Histórico de todas as conciliações realizadas neste navegador</p>
        </div>
        {total > 0 && (
          <button onClick={handleLimpar}
            style={{ fontSize: 12, color: '#A32D2D', background: '#FCEBEB', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={13} /> Limpar tudo
          </button>
        )}
      </div>

      {/* Cards resumo */}
      <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total de execuções', value: total, color: '#378ADD', icon: RefreshCw },
          { label: 'Taxa média conciliada', value: `${taxaMedia}%`, color: taxaMedia >= 80 ? '#1D9E75' : taxaMedia >= 50 ? '#BA7517' : '#E24B4A', icon: null },
          { label: 'Despesas', value: qtdDespesas, color: '#E24B4A', icon: TrendingDown },
          { label: 'Receitas', value: qtdReceitas, color: '#1D9E75', icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: '#F7F7FB', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
              {Icon && <Icon size={12} />} {label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Última execução destaque */}
      {ultima && (
        <div style={{ background: '#F0F7FF', border: '1px solid #BDD4F7', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
          <span style={{ fontWeight: 600, color: '#1A5FA8' }}>Última conciliação: </span>
          <span style={{ color: '#333' }}>
            {ultima.tipo === 'despesas' ? '📉 Despesas' : '📈 Receitas'} —{' '}
            {ultima.resumo?.conciliados || 0}/{ultima.resumo?.total_itens || 0} itens conciliados
            {ultima.periodo ? ` — ${formatarPeriodo(ultima.periodo)}` : ''} —{' '}
            {formatarData(ultima.data_execucao)}
          </span>
        </div>
      )}

      {/* Tabela histórico */}
      {total === 0 ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '48px 0' }}>
          <LayoutDashboard size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14 }}>Nenhuma conciliação realizada ainda.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Execute uma conciliação nas abas Despesas ou Receitas para registrar aqui.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #eee' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Data/Hora', 'Tipo', 'Período', 'Total', 'Conciliados', 'Taxa', 'Arquivos', ''].map(c => (
                  <th key={c} style={{ padding: '8px 12px', background: '#F5F5FA', fontWeight: 600, fontSize: 11, color: '#555', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #eee' }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.map((h, i) => {
                const r = h.resumo || {};
                const total_itens = r.total_itens || 0;
                const conciliados = r.conciliados || 0;
                const taxa = total_itens > 0 ? Math.round((conciliados / total_itens) * 100) : 0;
                return (
                  <tr key={h.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', color: '#555' }}>{formatarData(h.data_execucao)}</td>
                    <td style={{ padding: '7px 12px' }}>
                      <span style={{
                        background: h.tipo === 'despesas' ? '#FCEBEB' : '#E1F5EE',
                        color: h.tipo === 'despesas' ? '#A32D2D' : '#0F6E56',
                        borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700
                      }}>
                        {h.tipo === 'despesas' ? '📉 Despesas' : '📈 Receitas'}
                      </span>
                    </td>
                    <td style={{ padding: '7px 12px', color: '#555' }}>{formatarPeriodo(h.periodo)}</td>
                    <td style={{ padding: '7px 12px', fontWeight: 600 }}>{total_itens}</td>
                    <td style={{ padding: '7px 12px', fontWeight: 600, color: '#1D9E75' }}>{conciliados}</td>
                    <td style={{ padding: '7px 12px' }}><TaxaBar taxa={taxa} /></td>
                    <td style={{ padding: '7px 12px', color: '#888', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {Object.values(h.arquivos || {}).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '7px 12px' }}>
                      <button onClick={() => handleRemover(h.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 2 }}
                        title="Remover do histórico">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
