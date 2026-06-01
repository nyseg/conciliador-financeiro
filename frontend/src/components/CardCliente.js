import { useNavigate } from 'react-router-dom';

const COR_PRIMARIA = '#1A1A2E';
const COR_VERDE    = '#1D9E75';

function formatarData(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CardCliente({ cliente }) {
  const navigate = useNavigate();
  const ult = cliente.ultima_conciliacao;

  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid #E5E7EB',
        borderRadius: 14,
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'box-shadow .15s, border-color .15s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)';
        e.currentTarget.style.borderColor = COR_VERDE;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = '#E5E7EB';
      }}
    >
      {/* Cabeçalho */}
      <div>
        <div style={{ fontWeight: 800, fontSize: 16, color: COR_PRIMARIA, lineHeight: 1.3 }}>
          {cliente.nome_fantasia || cliente.razao_social}
        </div>
        {cliente.nome_fantasia && (
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            {cliente.razao_social}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: '#6B7280' }}>
        {cliente.cnpj && (
          <span>CNPJ: <strong style={{ color: '#374151' }}>{cliente.cnpj}</strong></span>
        )}
        {cliente.erp_utilizado && (
          <span>ERP: <strong style={{ color: '#374151' }}>{cliente.erp_utilizado}</strong></span>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #F3F4F6' }} />

      {/* Ultima conciliacao */}
      {ult ? (
        <div style={{ fontSize: 12 }}>
          <div style={{ color: '#6B7280', marginBottom: 6 }}>
            Ultima conciliacao: <strong style={{ color: '#374151' }}>{formatarData(ult.data)}</strong>
            {' '}&mdash; {ult.tipo === 'despesas' ? 'Despesas' : 'Receitas'} {ult.periodo && `(${ult.periodo})`}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{
              background: '#F0FDF4', color: '#16A34A',
              borderRadius: 20, padding: '3px 10px', fontWeight: 700, fontSize: 12,
            }}>
              OK {ult.conciliados}
            </span>
            <span style={{
              background: '#FEF2F2', color: '#DC2626',
              borderRadius: 20, padding: '3px 10px', fontWeight: 700, fontSize: 12,
            }}>
              Pendente {ult.pendentes}
            </span>
            {ult.total_fatura > 0 && (
              <span style={{ color: '#6B7280', alignSelf: 'center' }}>
                {formatarMoeda(ult.total_fatura)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>
          Nenhuma conciliacao realizada ainda
        </div>
      )}

      {/* Botao */}
      <button
        onClick={() => navigate(`/clientes/${cliente.id}`)}
        style={{
          marginTop: 4,
          background: COR_PRIMARIA,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '9px 16px',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          alignSelf: 'flex-start',
          transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = COR_VERDE}
        onMouseLeave={e => e.currentTarget.style.background = COR_PRIMARIA}
      >
        Entrar &rarr;
      </button>
    </div>
  );
}
