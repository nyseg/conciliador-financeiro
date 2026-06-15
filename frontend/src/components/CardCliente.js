import { useNavigate } from 'react-router-dom';

function calcularSaude(ult) {
  if (!ult) return { cor: '#8AA0BC', label: 'Aguardando', bg: '#EAF1FA' };
  const total = (ult.conciliados || 0) + (ult.pendentes || 0);
  const taxa = total > 0 ? (ult.conciliados / total) * 100 : 0;
  if (taxa >= 90) return { cor: '#0A7B5C', label: 'Ótimo',      bg: '#E5F5EF' };
  if (taxa >= 70) return { cor: '#8A5A00', label: 'Atenção',    bg: '#FEF3DC' };
  return             { cor: '#B83232', label: 'Pendências', bg: '#FDECEA' };
}

function formatarData(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Avatar({ nome }) {
  const inicial = (nome || '?')[0].toUpperCase();
  return (
    <div style={{
      width: 42,
      height: 42,
      borderRadius: 11,
      background: 'var(--ice)',
      color: 'var(--primary)',
      fontFamily: 'var(--font-serif)',
      fontSize: 18,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {inicial}
    </div>
  );
}

export default function CardCliente({ cliente }) {
  const navigate = useNavigate();
  const ult = cliente.ultima_conciliacao;
  const nomeExibido = cliente.nome_fantasia || cliente.razao_social;
  const saude = calcularSaude(ult);

  function handleMouseEnter(e) {
    e.currentTarget.style.boxShadow = '0 6px 24px rgba(11,31,58,0.10)';
    e.currentTarget.style.borderColor = 'var(--primary-l)';
  }
  function handleMouseLeave(e) {
    e.currentTarget.style.boxShadow = '0 1px 3px rgba(11,31,58,0.08), 0 1px 2px rgba(11,31,58,0.05)';
    e.currentTarget.style.borderColor = 'var(--border)';
  }

  return (
    <div
      style={{ ...s.card, borderLeft: `4px solid ${saude.cor}` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header do card */}
      <div style={s.cardHeader}>
        <Avatar nome={nomeExibido} />
        <div style={s.cardHeaderInfo}>
          <div style={s.cardTitle}>{nomeExibido}</div>
          {cliente.nome_fantasia && (
            <div style={s.cardSubtitle}>{cliente.razao_social}</div>
          )}
          {cliente.cnpj && (
            <div style={s.cardCnpj}>CNPJ: {cliente.cnpj}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {cliente.erp_utilizado && (
            <span style={s.erpBadge}>{cliente.erp_utilizado}</span>
          )}
          <span style={{ background: saude.bg, color: saude.cor, borderRadius: 100, padding: '3px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {saude.label}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={s.divider} />

      {/* Stats da última conciliação */}
      {ult ? (
        <div style={s.statsArea}>
          <div style={s.statsRow}>
            <div style={s.statConciliado}>
              <span style={s.statDotGreen} />
              <span style={s.statNum}>{ult.conciliados}</span>
              <span style={s.statLabel}>conciliados</span>
            </div>
            <div style={s.statPendente}>
              <span style={s.statDotRed} />
              <span style={{ ...s.statNum, color: '#B83232' }}>{ult.pendentes}</span>
              <span style={s.statLabel}>pendentes</span>
            </div>
          </div>
          <div style={s.lastConcil}>
            Última conciliação: {formatarData(ult.data)}
            {ult.tipo && ` — ${ult.tipo === 'despesas' ? 'Despesas' : 'Receitas'}`}
            {ult.total_fatura > 0 && ` · ${formatarMoeda(ult.total_fatura)}`}
          </div>
        </div>
      ) : (
        <div style={s.noConcil}>Nenhuma conciliação realizada ainda</div>
      )}

      {/* Footer do card */}
      <div style={s.cardFooter}>
        <button
          onClick={() => navigate(`/clientes/${cliente.id}`)}
          style={s.btnEntrar}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary-l)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--primary)'; }}
        >
          Entrar &rarr;
        </button>
      </div>
    </div>
  );
}

const s = {
  card: {
    background: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    boxShadow: '0 1px 3px rgba(11,31,58,0.08), 0 1px 2px rgba(11,31,58,0.05)',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    cursor: 'default',
  },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  cardHeaderInfo: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontWeight: 600, fontSize: 15, color: 'var(--text-1)', lineHeight: 1.3,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  cardSubtitle: {
    fontSize: 12, color: 'var(--text-3)', marginTop: 1,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  cardCnpj: { fontSize: 11, color: 'var(--text-3)', marginTop: 3 },
  erpBadge: {
    background: 'var(--ice)', color: 'var(--text-2)', borderRadius: 100,
    padding: '3px 10px', fontSize: 11, fontWeight: 500,
    whiteSpace: 'nowrap', flexShrink: 0, alignSelf: 'flex-start',
  },
  divider: { borderTop: '1px solid var(--border)', marginBottom: 14 },
  statsArea: { marginBottom: 14 },
  statsRow: { display: 'flex', gap: 20, marginBottom: 6 },
  statConciliado: { display: 'flex', alignItems: 'center', gap: 5 },
  statPendente: { display: 'flex', alignItems: 'center', gap: 5 },
  statDotGreen: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0A7B5C', flexShrink: 0 },
  statDotRed:   { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#B83232', flexShrink: 0 },
  statNum: { fontSize: 16, fontWeight: 700, color: '#0A7B5C' },
  statLabel: { fontSize: 12, color: 'var(--text-3)' },
  lastConcil: { fontSize: 11, color: 'var(--text-3)' },
  noConcil: { fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 14 },
  cardFooter: { display: 'flex', justifyContent: 'flex-end' },
  btnEntrar: {
    background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', padding: '4px 0',
    transition: 'color 150ms ease', letterSpacing: '0.01em',
  },
};
