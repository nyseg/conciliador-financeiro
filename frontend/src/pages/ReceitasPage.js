import { useState, useEffect } from 'react';
import { CreditCard, Building2, Landmark, Download, Play, AlertTriangle, RotateCcw } from 'lucide-react';
import UploadCard from '../components/UploadCard';
import MapeadorColunas from '../components/MapeadorColunas';
import TabelaResultado from '../components/TabelaResultado';
import { conciliarReceitas, previewColunas, exportarRelatorio } from '../api';
import { salvarHistorico } from '../utils/historico';
import { acordarServidor } from '../utils/servidor';

const SESSION_KEY = 'resultado_receitas';

const CAMPOS_ERP = [
  { key: 'data',         label: 'Coluna de Data' },
  { key: 'descricao',    label: 'Coluna de Descrição' },
  { key: 'valor',        label: 'Coluna de Valor' },
  { key: 'numero_fatura',label: 'Nº Referência / Fatura' },
  { key: 'status',       label: 'Coluna de Status' },
];

const CAMPOS_BANCO = [
  { key: 'data',     label: 'Coluna de Data' },
  { key: 'descricao',label: 'Coluna de Histórico' },
  { key: 'valor',    label: 'Coluna de Crédito / Valor' },
];

export default function ReceitasPage({ setProcessando, clienteId }) {
  const [operadora, setOperadora]         = useState(null);
  const [erp, setErp]                     = useState(null);
  const [banco, setBanco]                 = useState(null);
  const [periodoMes, setPeriodoMes]       = useState('');
  const [colunasErp, setColunasErp]       = useState([]);
  const [colunasBanco, setColunasBanco]   = useState([]);
  const [mapeamentoErp, setMapeamentoErp] = useState({});
  const [mapeamentoBanco, setMapeamentoBanco] = useState({});
  const [resultado, setResultado]         = useState(null);
  const [loading, setLoading]             = useState(false);
  const [loadingSeg, setLoadingSeg]       = useState(0);
  const [acordando, setAcordando]         = useState(false);
  const [acordandoTent, setAcordandoTent] = useState(0);
  const [erro, setErro]                   = useState('');

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) setResultado(JSON.parse(saved));
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!loading) { setLoadingSeg(0); return; }
    setLoadingSeg(0);
    const inicio = Date.now();
    const iv = setInterval(() => setLoadingSeg(Math.round((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  async function handleErpUpload(arquivo) {
    setErp(arquivo);
    try { const { colunas } = await previewColunas(arquivo, 'erp_receber'); setColunasErp(colunas); }
    catch (e) { console.error(e); }
  }

  async function handleBancoUpload(arquivo) {
    setBanco(arquivo);
    try { const { colunas } = await previewColunas(arquivo, 'banco'); setColunasBanco(colunas); }
    catch (e) { console.error(e); }
  }

  async function handleConciliar() {
    if (!operadora || !erp || !banco) { setErro('Envie os três arquivos antes de conciliar.'); return; }
    setErro('');
    setProcessando?.('receitas');

    setAcordando(true);
    setAcordandoTent(0);
    const online = await acordarServidor((tent) => setAcordandoTent(tent));
    setAcordando(false);

    if (!online) {
      setErro('Não foi possível conectar ao servidor após 60 segundos. Verifique se o backend está no ar.');
      setProcessando?.(null);
      return;
    }

    setLoading(true);
    try {
      const res = await conciliarReceitas({ operadora, erp, banco, mapeamentoErp, mapeamentoBanco, periodoMes, clienteId: clienteId || '' });
      setResultado(res);
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(res)); } catch (_) {}
      salvarHistorico({
        tipo: 'receitas',
        periodo: periodoMes,
        arquivos: { operadora: operadora.name, erp: erp.name, banco: banco.name },
        resumo: res.resumo,
      });
    } catch (e) {
      if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
        setErro('Timeout. Clique em Executar novamente — o servidor já está acordado.');
      } else if (!e.response) {
        setErro('Erro de conexão com o servidor. Tente novamente em alguns segundos.');
      } else {
        setErro(e.response?.data?.detail || 'Erro ao processar. Verifique os arquivos e tente novamente.');
      }
    } finally {
      setLoading(false);
      setProcessando?.(null);
    }
  }

  function handleLimpar() {
    setResultado(null);
    sessionStorage.removeItem(SESSION_KEY);
    setOperadora(null); setErp(null); setBanco(null);
    setColunasErp([]); setColunasBanco([]);
    setMapeamentoErp({}); setMapeamentoBanco({});
    setPeriodoMes(''); setErro('');
  }

  const r = resultado?.resumo;

  return (
    <div>
      {/* Título */}
      <div className="resp-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h2 style={s.pageTitle}>Conciliação de Receitas</h2>
          <p style={s.pageSubtitle}>
            Operadora vs ERP — Contas a Receber vs Extrato Bancário &nbsp;
            <span style={s.pageHint}>Aceita CSV, Excel, OFX/QFX ou PDF</span>
          </p>
        </div>
        {resultado && (
          <button onClick={handleLimpar} style={s.btnSecondary}>
            <RotateCcw size={12} /> Nova análise
          </button>
        )}
      </div>

      {/* Upload cards */}
      <div className="resp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 8 }}>
        <UploadCard titulo="Operadora de Cartão" subtitulo="Stone, Cielo, Rede… CSV, OFX ou PDF" icone={CreditCard}
          arquivo={operadora} onArquivo={setOperadora} />
        <UploadCard titulo="ERP — Contas a Receber" subtitulo="CSV, Excel ou PDF" icone={Building2}
          arquivo={erp} onArquivo={handleErpUpload} />
        <UploadCard titulo="Extrato Bancário" subtitulo="CSV, Excel, OFX/QFX ou PDF" icone={Landmark}
          arquivo={banco} onArquivo={handleBancoUpload} />
      </div>

      {colunasErp.length > 0 && (
        <MapeadorColunas colunas={colunasErp} mapeamento={mapeamentoErp}
          onChange={setMapeamentoErp} campos={CAMPOS_ERP} />
      )}
      {colunasBanco.length > 0 && (
        <MapeadorColunas colunas={colunasBanco} mapeamento={mapeamentoBanco}
          onChange={setMapeamentoBanco} campos={CAMPOS_BANCO} />
      )}

      {/* Controles */}
      <div className="resp-controls" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
        <div>
          <label style={s.controlLabel}>Período (opcional)</label>
          <input
            type="month"
            value={periodoMes}
            onChange={e => setPeriodoMes(e.target.value)}
            style={s.controlInput}
          />
        </div>
        <button
          onClick={handleConciliar}
          disabled={loading}
          style={{
            ...s.btnExecutar,
            marginTop: 20,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-l)'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--accent)'; }}
        >
          {loading
            ? <><div style={s.miniSpinner} /> Processando…</>
            : <><Play size={15} /> Executar Conciliação</>}
        </button>
      </div>

      {/* Acordando */}
      {acordando && (
        <div style={s.alertWarning}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid #FDE68A', borderTopColor: '#D97706', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
              Acordando o servidor… tentativa {acordandoTent}/12
            </div>
            <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
              O servidor estava em modo de espera. Aguarde até 60 segundos.
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={s.alertInfo}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid #BFDBFE', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
              Analisando arquivos… <span style={{ fontWeight: 400, color: '#475569' }}>{loadingSeg}s</span>
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              {loadingSeg < 15 ? 'Processando — pode navegar para outras abas normalmente.' :
               loadingSeg < 35 ? 'Servidor acordando do modo de espera (até 40s)…' :
               'Quase lá! Continue aguardando.'}
            </div>
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div style={s.alertDanger}>
          <AlertTriangle size={16} /> {erro}
        </div>
      )}

      {/* Resultado */}
      {resultado && r && (
        <div style={{ marginTop: 28, animation: 'fadeIn 0.2s ease' }}>
          {/* Cards contagem */}
          <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Total analisado', value: r.total_itens,  borderColor: 'var(--primary)', numColor: '#0F172A' },
              { label: 'Conciliados',     value: r.conciliados,  borderColor: '#0A7B5C', numColor: '#0A7B5C' },
              { label: 'Divergências',    value: r.divergencias, borderColor: '#D97706', numColor: '#D97706' },
              { label: 'Ausentes',        value: r.ausentes,     borderColor: '#DC2626', numColor: '#DC2626' },
            ].map(m => (
              <div key={m.label} style={{ ...s.statCard, borderLeftColor: m.borderColor }}>
                <div style={s.statLabel}>{m.label}</div>
                <div style={{ ...s.statNum, color: m.numColor }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Cards valores */}
          <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total operadora', value: `R$ ${r.total_operadora?.toFixed(2)}`, destaque: false },
              { label: 'Total ERP',       value: `R$ ${r.total_erp?.toFixed(2)}`,       destaque: false },
              { label: 'Total banco',     value: `R$ ${r.total_banco?.toFixed(2)}`,     destaque: false },
              { label: 'Dif. op. vs ERP', value: `R$ ${r.diferenca_op_erp?.toFixed(2)}`, destaque: r.diferenca_op_erp !== 0 },
            ].map(m => (
              <div key={m.label} style={{
                ...s.statCard,
                borderLeftColor: m.destaque ? '#D97706' : '#E2E8F0',
                background: m.destaque ? '#FFFBEB' : '#FFFFFF',
              }}>
                <div style={s.statLabel}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: m.destaque ? '#92400E' : '#0F172A' }}>{m.value}</div>
              </div>
            ))}
          </div>

          <TabelaResultado itens={resultado.itens} modo="receitas" />

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <button
              onClick={() => exportarRelatorio(resultado)}
              style={s.btnExportar}
              onMouseEnter={e => { e.currentTarget.style.background = '#047857'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0A7B5C'; }}
            >
              <Download size={15} /> Exportar Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  pageTitle: {
    fontSize: 20,
    fontWeight: 600,
    margin: 0,
    color: '#0F172A',
    letterSpacing: '-0.3px',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    margin: '4px 0 20px',
  },
  pageHint: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  btnSecondary: {
    fontSize: 12,
    color: '#475569',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  controlLabel: {
    fontSize: 12,
    color: '#475569',
    display: 'block',
    marginBottom: 4,
    fontWeight: 500,
  },
  controlInput: {
    padding: '7px 10px',
    borderRadius: 7,
    border: '1.5px solid #E2E8F0',
    fontSize: 13,
    background: '#FFFFFF',
    fontFamily: 'inherit',
    color: '#0F172A',
    outline: 'none',
  },
  btnExecutar: {
    padding: '10px 22px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: '0.01em',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'background 150ms ease',
  },
  miniSpinner: {
    width: 15,
    height: 15,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
    display: 'inline-block',
  },
  alertWarning: {
    background: '#FFFBEB',
    border: '1px solid #FDE68A',
    borderRadius: 8,
    padding: '14px 16px',
    marginTop: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    fontSize: 13,
    color: '#92400E',
  },
  alertInfo: {
    background: 'var(--ice)',
    border: '1px solid #BFDBFE',
    borderRadius: 8,
    padding: '14px 16px',
    marginTop: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  alertDanger: {
    background: '#FEF2F2',
    color: '#DC2626',
    border: '1px solid #FECACA',
    borderRadius: 8,
    padding: '10px 14px',
    marginTop: 12,
    fontSize: 13,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  statCard: {
    background: '#FFFFFF',
    borderLeft: '4px solid #E2E8F0',
    borderRadius: 8,
    padding: '14px 16px',
    border: '1px solid #E2E8F0',
    borderLeftWidth: 4,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 6,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statNum: {
    fontSize: 26,
    fontWeight: 700,
    color: '#0F172A',
    lineHeight: 1,
  },
  btnExportar: {
    padding: '9px 20px',
    background: '#0A7B5C',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 150ms ease',
  },
};
