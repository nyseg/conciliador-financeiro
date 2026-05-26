import { useState } from 'react';
import { Link2, X } from 'lucide-react';

// ── Badges de status ─────────────────────────────────────────────────────────
const BADGE = {
  ok:              { bg: '#E1F5EE', color: '#0F6E56', label: '✅ Conciliado' },
  ok_manual:       { bg: '#EEF4FD', color: '#1A5FA8', label: '🔗 Manual' },
  ausente_erp:     { bg: '#FCEBEB', color: '#A32D2D', label: '❌ Sem ERP' },
  ausente_fatura:  { bg: '#FAEEDA', color: '#854F0B', label: '⚠️ Sem fatura' },
  divergencia:     { bg: '#FAEEDA', color: '#854F0B', label: '⚠️ Divergência' },
  ausente_ambos:   { bg: '#FCEBEB', color: '#A32D2D', label: '❌ Ausente' },
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

// ── Componente principal ──────────────────────────────────────────────────────
export default function TabelaResultado({ itens, modo, onManualMatch }) {
  const [filtro, setFiltro] = useState('todos');
  const [matchingItem, setMatchingItem] = useState(null); // { item, originalIdx }

  // Adiciona índice original para rastrear após filtro
  const itensComIdx = itens.map((item, idx) => ({ ...item, _originalIdx: idx }));
  const filtrados = filtro === 'todos'
    ? itensComIdx
    : itensComIdx.filter(i => i.status === filtro);

  const totalFatura = filtrados.reduce((a, i) => a + (i.valor_fatura || i.valor_operadora || 0), 0);
  const totalErp    = filtrados.reduce((a, i) => a + (i.valor_erp || 0), 0);

  // Itens elegíveis para o painel de matching (status oposto ao item selecionado)
  const itensPairing = !matchingItem ? [] : itensComIdx.filter(i => {
    if (matchingItem.item.status === 'ausente_erp')    return i.status === 'ausente_fatura';
    if (matchingItem.item.status === 'ausente_fatura') return i.status === 'ausente_erp';
    return false;
  });

  function confirmarMatch(oposto) {
    onManualMatch(matchingItem.item._originalIdx, oposto._originalIdx);
    setMatchingItem(null);
    // Volta para "todos" para mostrar o item merged
    setFiltro('todos');
  }

  const podeMatch = status => onManualMatch && (status === 'ausente_erp' || status === 'ausente_fatura');

  const colunas = modo === 'despesas'
    ? ['Data Fatura', 'Estabelecimento', 'Cartão', 'Vlr Fatura', 'Data ERP', 'Categoria ERP', 'Vlr ERP', 'Sit. ERP', 'Status', ...(onManualMatch ? [''] : [])]
    : ['Data Operadora', 'Descrição', 'Vlr Operadora', 'Data ERP', 'Desc. ERP', 'Vlr ERP', 'Vlr Banco', 'Status'];

  const getCells = (item) => {
    const acaoCell = podeMatch(item.status) ? (
      <button
        onClick={() => setMatchingItem(prev =>
          prev?.item._originalIdx === item._originalIdx ? null : { item, originalIdx: item._originalIdx }
        )}
        title="Conciliar manualmente"
        style={{
          background: matchingItem?.item._originalIdx === item._originalIdx ? '#1A5FA8' : '#EEF4FD',
          color:      matchingItem?.item._originalIdx === item._originalIdx ? '#fff'    : '#1A5FA8',
          border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
        }}>
        <Link2 size={11} /> Conciliar
      </button>
    ) : null;

    if (modo === 'despesas') {
      const cells = [
        item.data_fatura, item.descricao_fatura, item.cartao,
        `R$ ${(item.valor_fatura || 0).toFixed(2)}`, item.data_erp,
        item.descricao_erp, `R$ ${(item.valor_erp || 0).toFixed(2)}`,
        <SitBadge sit={item.status_erp} />, <Badge status={item.status} />,
      ];
      if (onManualMatch) cells.push(acaoCell);
      return cells;
    }
    return [
      item.data_operadora, item.descricao_operadora,
      `R$ ${(item.valor_operadora || 0).toFixed(2)}`, item.data_erp,
      item.descricao_erp, `R$ ${(item.valor_erp || 0).toFixed(2)}`,
      `R$ ${(item.valor_banco || 0).toFixed(2)}`, <Badge status={item.status} />,
    ];
  };

  const qtd = s => itens.filter(i => i.status === s).length;

  return (
    <div>
      {/* Filtro */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: '#666' }}>Filtrar:</label>
        <select value={filtro} onChange={e => { setFiltro(e.target.value); setMatchingItem(null); }}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12 }}>
          <option value="todos">Todos ({itens.length})</option>
          <option value="ok">✅ Conciliados ({qtd('ok')})</option>
          {qtd('ok_manual') > 0 && <option value="ok_manual">🔗 Manuais ({qtd('ok_manual')})</option>}
          {modo === 'despesas' && <>
            <option value="ausente_erp">❌ Sem ERP ({qtd('ausente_erp')})</option>
            <option value="ausente_fatura">⚠️ Sem fatura ({qtd('ausente_fatura')})</option>
          </>}
          {modo === 'receitas' && <>
            <option value="divergencia">⚠️ Divergência ({qtd('divergencia')})</option>
            <option value="ausente_ambos">❌ Ausentes ({qtd('ausente_ambos')})</option>
          </>}
        </select>

        {onManualMatch && (qtd('ausente_erp') > 0 || qtd('ausente_fatura') > 0) && (
          <span style={{ fontSize: 11, color: '#1A5FA8', background: '#EEF4FD', borderRadius: 4, padding: '3px 8px' }}>
            💡 Clique em <strong>Conciliar</strong> em itens não encontrados para fazer o vínculo manual
          </span>
        )}
      </div>

      {/* Painel de matching manual */}
      {matchingItem && (
        <div style={{ background: '#EFF6FF', border: '1px solid #BDD4F7', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A5FA8' }}>
                🔗 Selecione o item {matchingItem.item.status === 'ausente_erp' ? 'do ERP' : 'da Fatura'} para conciliar com:
              </div>
              <div style={{ fontSize: 12, color: '#333', marginTop: 2 }}>
                <strong>{matchingItem.item.descricao_fatura || matchingItem.item.descricao_erp}</strong>
                {' '} — R$ {((matchingItem.item.valor_fatura || matchingItem.item.valor_erp) || 0).toFixed(2)}
                {matchingItem.item.data_fatura && matchingItem.item.data_fatura !== '—' && ` — ${matchingItem.item.data_fatura}`}
                {matchingItem.item.data_erp && matchingItem.item.data_erp !== '—' && ` — ${matchingItem.item.data_erp}`}
              </div>
            </div>
            <button onClick={() => setMatchingItem(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 2 }}>
              <X size={16} />
            </button>
          </div>

          {itensPairing.length === 0 ? (
            <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>
              Nenhum item disponível para conciliar. Todos já foram vinculados.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
              {itensPairing.map(op => (
                <button key={op._originalIdx} onClick={() => confirmarMatch(op)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 12px', background: '#fff', border: '1px solid #D4E6FF',
                    borderRadius: 7, cursor: 'pointer', fontSize: 12, textAlign: 'left',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <span style={{ color: '#333' }}>
                    {op.descricao_erp !== '—' ? op.descricao_erp : op.descricao_fatura}
                    {(op.data_erp && op.data_erp !== '—') && <span style={{ color: '#888', marginLeft: 8 }}>{op.data_erp}</span>}
                    {(op.data_fatura && op.data_fatura !== '—') && <span style={{ color: '#888', marginLeft: 8 }}>{op.data_fatura}</span>}
                  </span>
                  <span style={{ fontWeight: 700, color: '#1A5FA8', whiteSpace: 'nowrap', marginLeft: 12 }}>
                    R$ {((op.valor_erp || op.valor_fatura) || 0).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabela */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #eee' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {colunas.map((c, i) => (
                <th key={i} style={{ padding: '8px 10px', background: '#F5F5FA', fontWeight: 600, fontSize: 11, color: '#555', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #eee' }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((item, i) => (
              <tr key={i}
                style={{
                  background: matchingItem?.item._originalIdx === item._originalIdx
                    ? '#EFF6FF'
                    : i % 2 === 0 ? '#fff' : '#FAFAFA',
                }}>
                {getCells(item).map((cell, j) => (
                  <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {/* Linha de totais */}
            <tr style={{ background: '#F5F5FA', fontWeight: 700 }}>
              <td colSpan={modo === 'despesas' ? 3 : 2} style={{ padding: '7px 10px', fontSize: 12 }}>Total</td>
              <td style={{ padding: '7px 10px' }}>R$ {totalFatura.toFixed(2)}</td>
              <td colSpan={modo === 'despesas' ? 2 : 1}></td>
              <td style={{ padding: '7px 10px' }}>R$ {totalErp.toFixed(2)}</td>
              <td colSpan={modo === 'despesas' ? (onManualMatch ? 3 : 2) : 2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11, color: '#bbb', marginTop: 6, textAlign: 'right' }}>
        {filtrados.length} de {itens.length} itens exibidos
      </div>
    </div>
  );
}
