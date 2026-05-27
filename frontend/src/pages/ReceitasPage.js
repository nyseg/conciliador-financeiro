import { useState, useEffect } from 'react';
import { CreditCard, Building2, Landmark, Download, Play, AlertTriangle, RotateCcw } from 'lucide-react';
import UploadCard from '../components/UploadCard';
import MapeadorColunas from '../components/MapeadorColunas';
import TabelaResultado from '../components/TabelaResultado';
import { conciliarReceitas, previewColunas, exportarRelatorio } from '../api';
import { salvarHistorico } from '../utils/historico';

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

export default function ReceitasPage({ setProcessando }) {
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
  const [erro, setErro]                   = useState('');

  // ── Restaura resultado da sessão ──────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) setResultado(JSON.parse(saved));
    } catch (_) {}
  }, []);

  // ── Cronômetro ────────────────────────────────────────────────────────────
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
    setLoading(true);
    setProcessando?.('receitas');
    try {
      const res = await conciliarReceitas({ operadora, erp, banco, mapeamentoErp, mapeamentoBanco, periodoMes });
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
        setErro('⏱ O servidor demorou mais de 2 minutos. Tente novamente — agora estará acordado e será rápido.');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Conciliação de Receitas</h2>
          <p style={{ fontSize: 13, color: '#666', margin: '4px 0 20px' }}>
            Operadora vs ERP — Contas a Receber vs Extrato Bancário &nbsp;
            <span style={{ fontSize: 11, color: '#aaa' }}>Aceita CSV, Excel ou OFX/QFX</span>
          </p>
        </div>
        {resultado && (
          <button onClick={handleLimpar}
            style={{ fontSize: 12, color: '#888', background: '#F5F5FA', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <RotateCcw size={12} /> Nova análise
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 8 }}>
        <UploadCard titulo="Operadora de Cartão" subtitulo="Stone, Cielo, Rede… CSV/OFX" icone={CreditCard}
          arquivo={operadora} onArquivo={setOperadora} />
        <UploadCard titulo="ERP — Contas a Receber" subtitulo="CSV ou Excel do ERP" icone={Building2}
          arquivo={erp} onArquivo={handleErpUpload} />
        <UploadCard titulo="Extrato Bancário" subtitulo="CSV, Excel ou OFX/QFX" icone={Landmark}
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

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Período (opcional)</label>
          <input type="month" value={periodoMes} onChange={e => setPeriodoMes(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
        </div>
        <button onClick={handleConciliar} disabled={loading}
          style={{ marginTop: 20, padding: '9px 22px', background: '#1A1A2E', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading
            ? <><div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} /> Processando…</>
            : <><Play size={15} /> Executar Conciliação</>}
        </button>
      </div>

      {loading && (
        <div style={{ background: '#F0F7FF', border: '1px solid #BDD4F7', borderRadius: 8, padding: '14px 16px', marginTop: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid #BDD4F7', borderTopColor: '#1A5FA8', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A5FA8' }}>
              Analisando arquivos… <span style={{ fontWeight: 400, color: '#555' }}>{loadingSeg}s</span>
            </div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
              {loadingSeg < 15 ? 'Processando — pode navegar para outras abas normalmente.' :
               loadingSeg < 35 ? '⏳ Servidor acordando do modo de espera (até 40s)…' :
               '🔄 Quase lá! Continue aguardando.'}
            </div>
          </div>
        </div>
      )}

      {erro && (
        <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, display: 'flex', gap: 8 }}>
          <AlertTriangle size={16} /> {erro}
        </div>
      )}

      {resultado && r && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total analisado', value: r.total_itens,  color: '#378ADD' },
              { label: 'Conciliados',     value: r.conciliados,  color: '#1D9E75' },
              { label: 'Divergências',    value: r.divergencias, color: '#BA7517' },
              { label: 'Ausentes',        value: r.ausentes,     color: '#E24B4A' },
            ].map(m => (
              <div key={m.label} style={{ background: '#F7F7FB', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total operadora', value: `R$ ${r.total_operadora?.toFixed(2)}` },
              { label: 'Total ERP',       value: `R$ ${r.total_erp?.toFixed(2)}` },
              { label: 'Total banco',     value: `R$ ${r.total_banco?.toFixed(2)}` },
              { label: 'Dif. op. vs ERP', value: `R$ ${r.diferenca_op_erp?.toFixed(2)}`, destaque: r.diferenca_op_erp !== 0 },
            ].map(m => (
              <div key={m.label} style={{ background: m.destaque ? '#FEF3E2' : '#F7F7FB', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#888' }}>{m.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: m.destaque ? '#8A4A00' : '#333' }}>{m.value}</div>
              </div>
            ))}
          </div>

          <TabelaResultado itens={resultado.itens} modo="receitas" />

          <div style={{ textAlign: 'right', marginTop: 14 }}>
            <button onClick={() => exportarRelatorio(resultado)}
              style={{ padding: '8px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={15} /> Exportar Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
