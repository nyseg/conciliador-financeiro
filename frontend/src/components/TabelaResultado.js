import { useState } from 'react';

const BADGE = {
  ok: { bg: '#E1F5EE', color: '#0F6E56', label: '✅ Conciliado' },
  ausente_erp: { bg: '#FCEBEB', color: '#A32D2D', label: '❌ Sem ERP' },
  ausente_fatura: { bg: '#FAEEDA', color: '#854F0B', label: '⚠️ Sem fatura' },
  divergencia: { bg: '#FAEEDA', color: '#854F0B', label: '⚠️ Divergência' },
};

function Badge({ status }) {
  const b = BADGE[status] || { bg: '#eee', color: '#333', label: status };
  return (
    <span style={{ background: b.bg, color: b.color, borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {b.label}
    </span>
  );
}

function SitBadge({ sit }) {
  if (!sit || sit === '—') return <span style={{ color: '#bbb' }}>—</span>;
  const isPaga = sit.toLowerCase() === 'paga';
  return (
    <span style={{ background: isPaga ? '#EEF4FD' : '#FEF3E2', color: isPaga ? '#1A5FA8' : '#8A4A00', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
      {sit}
    </span>
  );
}

export default function TabelaResultado({ itens, modo }) {
  const [filtro, setFiltro] = useState('todos');

  const filtrados = filtro === 'todos' ? itens : itens.filter(i => i.status === filtro);

  const totalFatura = filtrados.reduce((a, i) => a + (i.valor_fatura || i.valor_operadora || 0), 0);
  const totalErp = filtrados.reduce((a, i) => a + (i.valor_erp || 0), 0);

  const colunas = modo === 'despesas'
    ? ['Data Fatura', 'Estabelecimento', 'Cartão', 'Vlr Fatura', 'Data ERP', 'Categoria ERP', 'Vlr ERP', 'Sit. ERP', 'Status']
    : ['Data Operadora', 'Descrição', 'Vlr Operadora', 'Data ERP', 'Desc. ERP', 'Vlr ERP', 'Vlr Banco', 'Status'];

  const getCells = (item) => modo === 'despesas'
    ? [item.data_fatura, item.descricao_fatura, item.cartao,
       `R$ ${(item.valor_fatura||0).toFixed(2)}`, item.data_erp,
       item.descricao_erp, `R$ ${(item.valor_erp||0).toFixed(2)}`,
       <SitBadge sit={item.status_erp} />, <Badge status={item.status} />]
    : [item.data_operadora, item.descricao_operadora,
       `R$ ${(item.valor_operadora||0).toFixed(2)}`, item.data_erp,
       item.descricao_erp, `R$ ${(item.valor_erp||0).toFixed(2)}`,
       `R$ ${(item.valor_banco||0).toFixed(2)}`, <Badge status={item.status} />];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#666' }}>Filtrar:</label>
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12 }}>
          <option value="todos">Todos ({itens.length})</option>
          <option value="ok">✅ Conciliados ({itens.filter(i => i.status === 'ok').length})</option>
          {modo === 'despesas' && <>
            <option value="ausente_erp">❌ Sem ERP ({itens.filter(i => i.status === 'ausente_erp').length})</option>
            <option value="ausente_fatura">⚠️ Sem fatura ({itens.filter(i => i.status === 'ausente_fatura').length})</option>
          </>}
          {modo === 'receitas' && <>
            <option value="divergencia">⚠️ Divergência ({itens.filter(i => i.status === 'divergencia').length})</option>
            <option value="ausente_ambos">❌ Ausentes ({itens.filter(i => i.status === 'ausente_ambos').length})</option>
          </>}
        </select>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #eee' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {colunas.map(c => (
                <th key={c} style={{ padding: '8px 10px', background: '#F5F5FA', fontWeight: 600, fontSize: 11, color: '#555', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #eee' }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                {getCells(item).map((cell, j) => (
                  <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ background: '#F5F5FA', fontWeight: 700 }}>
              <td colSpan={modo === 'despesas' ? 3 : 2} style={{ padding: '7px 10px', fontSize: 12 }}>Total</td>
              <td style={{ padding: '7px 10px' }}>R$ {totalFatura.toFixed(2)}</td>
              <td colSpan={modo === 'despesas' ? 2 : 1}></td>
              <td style={{ padding: '7px 10px' }}>R$ {totalErp.toFixed(2)}</td>
              <td colSpan={modo === 'despesas' ? 2 : 2}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
