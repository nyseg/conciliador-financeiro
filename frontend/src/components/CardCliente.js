import { useNavigate } from 'react-router-dom';

function calcularSaude(ult) {
  if (!ult) return { cor: '#94A3B8', label: 'Aguardando', bg: '#F1F5F9' };
  const total = (ult.conciliados || 0) + (ult.pendentes || 0);
  const taxa = total > 0 ? (ult.conciliados / total) * 100 : 0;
  if (taxa >= 90) return { cor: '#059669', label: 'Ótimo',      bg: '#ECFDF5' };
  if (taxa >= 70) return { cor: '#D97706', label: 'Atenção',    bg: '#FFFBEB' };
  return             { cor: '#DC2626', label: 'Pendências', bg: '#FEF2F2' };
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
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: '#EFF6FF',
      color: '#2563EB',
      fontSize: 16,
      fontWeight: 700,
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
    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)';
  }
  function handleMouseLeave(e) {
    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)';
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
          <span style={{ background: saude.bg, color: saude.cor, borderRadius: 20, padding: '3px 9px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
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
              <span style={{ ...s.statNum, color: '#DC2626' }}>{ult.pendentes}</span>
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
          onMouseEnter={e => { e.currentTarget.style.color = '#1D4ED8'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#2563EB'; }}
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
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    cursor: 'default',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  cardHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: 15,
    color: '#0F172A',
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardCnpj: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  erpBadge: {
    background: '#F1F5F9',
    color: '#475569',
    borderRadius: 20,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  divider: {
    borderTop: '1px solid #F1F5F9',
    marginBottom: 14,
  },
  statsArea: {
    marginBottom: 14,
  },
  statsRow: {
    display: 'flex',
    gap: 20,
    marginBottom: 6,
  },
  statConciliado: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  statPendente: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  statDotGreen: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#059669',
    flexShrink: 0,
  },
  statDotRed: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#DC2626',
    flexShrink: 0,
  },
  statNum: {
    fontSize: 16,
    fontWeight: 700,
    color: '#059669',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  lastConcil: {
    fontSize: 11,
    color: '#94A3B8',
  },
  noConcil: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 14,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  btnEntrar: {
    background: 'none',
    border: 'none',
    color: '#2563EB',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 0',
    transition: 'color 150ms ease',
    letterSpacing: '0.01em',
  },
};
