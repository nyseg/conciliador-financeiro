import { useState } from 'react';
import { Link2, X } from 'lucide-react';

// ── Badges de status ─────────────────────────────────────────────────────────
const BADGE = {
  ok:              { bg: '#E5F5EF', color: '#0A7B5C',  label: '✅ Conciliado' },
  ok_parcela:      { bg: 'var(--ice)', color: 'var(--primary)',  label: '📋 Parcela' },
  ok_categoria:    { bg: '#E5F5EF', color: '#0A7B5C',  label: '📦 Agrupado' },
  ok_manual:       { bg: 'var(--ice)', color: 'var(--primary)',  label: '🔗 Manual' },
  ok_data_div:     { bg: '#FEF3DC', color: '#8A5A00',  label: '⚠️ Data divergente' },
  ok_encargo:      { bg: '#E5F5EF', color: '#0A7B5C',  label: '✅ Encargo ERP' },
  ausente_erp:     { bg: '#FDECEA', color: '#B83232',  label: '❌ Sem ERP' },
  ausente_fatura:  { bg: '#FEF3DC', color: '#8A5A00',  label: '⚠️ Sem fatura' },
  divergencia:     { bg: '#FEF3DC', color: '#8A5A00',  label: '⚠️ Divergência' },
  ausente_ambos:   { bg: '#FDECEA', color: '#B83232',  label: '❌ Ausente' },
};

function Badge({ status }) {
  const b = BADGE[status] || { bg: '#F1F5F9', color: '#475569', label: status };
  return (
    <span style={{
      background: b.bg,
      color: b.color,
      borderRadius: 4,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {b.label}
    </span>
  );
}

function SitBadge({ sit }) {
  if (!sit || sit === '—') return <span style={{ color: '#CBD5E1' }}>—</span>;
  const isPaga = sit.toLowerCase().includes('pag') || sit.toLowerCase().includes('liquid');
  return (
    <span style={{
      background: isPaga ? '#E5F5EF' : '#FEF3DC',
      color: isPaga ? '#0A7B5C' : '#8A5A00',
      borderRadius: 4,
      padding: '1px 7px',
      fontSize: 11,
      fontWeight: 600,
    }}>
      {sit}
    </span>
  );
}

function ParcelaBadge({ parcela, totalEstimado }) {
  if (!parcela) return <span style={{ color: '#CBD5E1' }}>—</span>;
  return (
    <span
      title={totalEstimado ? `Total estimado: R$ ${totalEstimado.toFixed(2)}` : ''}
      style={{
        background: 'var(--ice)',
        color: 'var(--primary)',
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'help',
      }}
    >
      {parcela}
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TabelaResultado({ itens, modo, onManualMatch }) {
  const [filtro, setFiltro]             = useState('todos');
  const [matchingItem, setMatchingItem] = useState(null);

  const itensComIdx = itens.map((item, idx) => ({ ...item, _originalIdx: idx }));
  const filtrados   = filtro === 'todos'
    ? itensComIdx
    : itensComIdx.filter(i => i.status === filtro);

  const totalFatura = filtrados.reduce((a, i) => a + (i.valor_fatura || i.valor_operadora || 0), 0);
  const totalErp    = filtrados.reduce((a, i) => a + (i.valor_erp || 0), 0);

  const itensPairing = !matchingItem ? [] : itensComIdx.filter(i => {
    if (matchingItem.item.status === 'ausente_erp')    return i.status === 'ausente_fatura';
    if (matchingItem.item.status === 'ausente_fatura') return i.status === 'ausente_erp';
    return false;
  });

  function confirmarMatch(oposto) {
    onManualMatch(matchingItem.item._originalIdx, oposto._originalIdx);
    setMatchingItem(null);
    setFiltro('todos');
  }

  const podeMatch = status => onManualMatch && (status === 'ausente_erp' || status === 'ausente_fatura');
  const qtd = s => itens.filter(i => i.status === s).length;
  const qtdOk = () => itens.filter(i => ['ok','ok_parcela','ok_categoria','ok_manual','ok_data_div','ok_encargo'].includes(i.status)).length;

  const temParcela   = modo === 'despesas' && itens.some(i => i.parcela);
  const temCategoria = modo === 'despesas' && itens.some(i => i.categoria_erp && i.categoria_erp !== '' && i.categoria_erp !== 'None' && i.categoria_erp !== 'nan');

  const colunas = modo === 'despesas'
    ? [
        'Data Fatura', 'Estabelecimento', 'Cartão',
        'Vlr Fatura',
        ...(temParcela ? ['Parcela'] : []),
        'Data ERP', 'Fornecedor / ERP',
        ...(temCategoria ? ['Categoria'] : []),
        'Vlr ERP', 'Sit. ERP', 'Status',
        ...(onManualMatch ? [''] : []),
      ]
    : ['Data Operadora', 'Descrição', 'Vlr Operadora', 'Data ERP', 'Desc. ERP', 'Vlr ERP', 'Vlr Banco', 'Status'];

  const getCells = (item) => {
    const acaoCell = podeMatch(item.status) ? (
      <button
        onClick={() => setMatchingItem(prev =>
          prev?.item._originalIdx === item._originalIdx ? null : { item, originalIdx: item._originalIdx }
        )}
        title="Conciliar manualmente"
        style={{
          background: matchingItem?.item._originalIdx === item._originalIdx ? 'var(--primary)' : 'var(--ice)',
          color:      matchingItem?.item._originalIdx === item._originalIdx ? '#fff'    : 'var(--primary)',
          border: 'none',
          borderRadius: 5,
          padding: '3px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
          transition: 'all 150ms ease',
        }}
      >
        <Link2 size={11} /> Conciliar
      </button>
    ) : null;

    if (modo === 'despesas') {
      const cells = [
        item.data_fatura,
        item.descricao_fatura,
        item.cartao,
        `R$ ${(item.valor_fatura || 0).toFixed(2)}`,
      ];
      if (temParcela) cells.push(
        <ParcelaBadge parcela={item.parcela} totalEstimado={item.valor_total_estimado} />
      );
      cells.push(item.data_erp, item.descricao_erp);
      if (temCategoria) cells.push(
        item.categoria_erp && item.categoria_erp !== 'None' && item.categoria_erp !== 'nan'
          ? <span style={{ fontSize: 11, background: '#F1F5F9', borderRadius: 4, padding: '1px 6px', color: '#475569' }}>{item.categoria_erp}</span>
          : <span style={{ color: '#CBD5E1' }}>—</span>
      );
      cells.push(
        `R$ ${(item.valor_erp || 0).toFixed(2)}`,
        <SitBadge sit={item.status_erp} />,
        <Badge status={item.status} />,
      );
      if (onManualMatch) cells.push(acaoCell);
      return cells;
    }

    return [
      item.data_operadora, item.descricao_operadora,
      `R$ ${(item.valor_operadora || 0).toFixed(2)}`,
      item.data_erp, item.descricao_erp,
      `R$ ${(item.valor_erp || 0).toFixed(2)}`,
      `R$ ${(item.valor_banco || 0).toFixed(2)}`,
      <Badge status={item.status} />,
    ];
  };

  return (
    <div>
      {/* Filtro */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>Filtrar:</label>
        <select
          value={filtro}
          onChange={e => { setFiltro(e.target.value); setMatchingItem(null); }}
          style={{
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid #E2E8F0',
            fontSize: 12,
            fontFamily: 'inherit',
            color: '#0F172A',
            background: '#FFFFFF',
            outline: 'none',
          }}
        >
          <option value="todos">Todos ({itens.length})</option>
          <option value="ok">✅ Conciliados ({qtdOk()})</option>
          {qtd('ok_parcela') > 0   && <option value="ok_parcela">📋 Parcelas ({qtd('ok_parcela')})</option>}
          {qtd('ok_categoria') > 0 && <option value="ok_categoria">📦 Agrupados ({qtd('ok_categoria')})</option>}
          {qtd('ok_manual') > 0    && <option value="ok_manual">🔗 Manuais ({qtd('ok_manual')})</option>}
          {qtd('ok_data_div') > 0  && <option value="ok_data_div">⚠️ Data divergente ({qtd('ok_data_div')})</option>}
          {qtd('ok_encargo') > 0   && <option value="ok_encargo">✅ Encargo ERP ({qtd('ok_encargo')})</option>}
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
          <span style={{
            fontSize: 11,
            color: 'var(--primary)',
            background: 'var(--ice)',
            borderRadius: 4,
            padding: '3px 8px',
            fontWeight: 500,
          }}>
            Clique em <strong>Conciliar</strong> para vincular manualmente
          </span>
        )}
      </div>

      {/* Painel de matching manual */}
      {matchingItem && (
        <div style={{
          background: 'var(--ice)',
          border: '1px solid #BFDBFE',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 14,
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
                Selecione o item {matchingItem.item.status === 'ausente_erp' ? 'do ERP' : 'da Fatura'} para vincular com:
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                <strong>{matchingItem.item.descricao_fatura || matchingItem.item.descricao_erp}</strong>
                {' — '}R$ {((matchingItem.item.valor_fatura || matchingItem.item.valor_erp) || 0).toFixed(2)}
              </div>
            </div>
            <button
              onClick={() => setMatchingItem(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}
            >
              <X size={16} />
            </button>
          </div>

          {itensPairing.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
              Nenhum item disponível. Todos já foram vinculados.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
              {itensPairing.map(op => (
                <button
                  key={op._originalIdx}
                  onClick={() => confirmarMatch(op)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#FFFFFF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 7,
                    cursor: 'pointer',
                    fontSize: 12,
                    textAlign: 'left',
                    transition: 'background 150ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ice)'}
                  onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                >
                  <span style={{ color: '#0F172A' }}>
                    {op.descricao_erp !== '—' ? op.descricao_erp : op.descricao_fatura}
                    {(op.data_erp && op.data_erp !== '—') && <span style={{ color: '#94A3B8', marginLeft: 8 }}>{op.data_erp}</span>}
                    {(op.data_fatura && op.data_fatura !== '—') && <span style={{ color: '#94A3B8', marginLeft: 8 }}>{op.data_fatura}</span>}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap', marginLeft: 12 }}>
                    R$ {((op.valor_erp || op.valor_fatura) || 0).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabela */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {colunas.map((c, i) => (
                <th key={i} style={{
                  padding: '10px 12px',
                  fontWeight: 600,
                  fontSize: 11,
                  color: '#94A3B8',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((item, i) => (
              <tr
                key={i}
                style={{
                  background: matchingItem?.item._originalIdx === item._originalIdx
                    ? 'var(--ice)'
                    : i % 2 === 0 ? '#FFFFFF' : '#FAFBFC',
                }}
              >
                {getCells(item).map((cell, j) => (
                  <td key={j} style={{
                    padding: '7px 12px',
                    borderBottom: '1px solid #F1F5F9',
                    whiteSpace: 'nowrap',
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: '#475569',
                    fontSize: 12,
                  }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {/* Totais */}
            <tr style={{ background: '#F8FAFC', fontWeight: 700, borderTop: '1px solid #E2E8F0' }}>
              <td
                colSpan={modo === 'despesas' ? (temParcela ? 4 : 3) : 2}
                style={{ padding: '8px 12px', fontSize: 12, color: '#0F172A' }}
              >
                Total
              </td>
              <td style={{ padding: '8px 12px', color: '#0F172A', fontWeight: 700 }}>R$ {totalFatura.toFixed(2)}</td>
              <td colSpan={modo === 'despesas' ? (temCategoria ? 3 : 2) : 1}></td>
              <td style={{ padding: '8px 12px', color: '#0F172A', fontWeight: 700 }}>R$ {totalErp.toFixed(2)}</td>
              <td colSpan={modo === 'despesas' ? (onManualMatch ? 3 : 2) : 2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 6, textAlign: 'right' }}>
        {filtrados.length} de {itens.length} itens exibidos
      </div>
    </div>
  );
}
