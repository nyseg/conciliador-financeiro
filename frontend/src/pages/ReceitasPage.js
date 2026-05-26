import { useState } from 'react';
import { CreditCard, Building2, Landmark, Download, Play, AlertTriangle } from 'lucide-react';
import UploadCard from '../components/UploadCard';
import MapeadorColunas from '../components/MapeadorColunas';
import TabelaResultado from '../components/TabelaResultado';
import { conciliarReceitas, previewColunas, exportarRelatorio } from '../api';

const CAMPOS_ERP = [
  { key: 'data', label: 'Coluna de Data' },
  { key: 'descricao', label: 'Coluna de Descrição' },
  { key: 'valor', label: 'Coluna de Valor' },
  { key: 'numero_fatura', label: 'Nº Referência / Fatura' },
  { key: 'status', label: 'Coluna de Status' },
];

const CAMPOS_BANCO = [
  { key: 'data', label: 'Coluna de Data' },
  { key: 'descricao', label: 'Coluna de Histórico' },
  { key: 'valor', label: 'Coluna de Crédito / Valor' },
];

export default function ReceitasPage() {
  const [operadora, setOperadora] = useState(null);
  const [erp, setErp] = useState(null);
  const [banco, setBanco] = useState(null);
  const [periodoMes, setPeriodoMes] = useState('');
  const [colunasErp, setColunasErp] = useState([]);
  const [colunasBanco, setColunasBanco] = useState([]);
  const [mapeamentoErp, setMapeamentoErp] = useState({});
  const [mapeamentoBanco, setMapeamentoBanco] = useState({});
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function handleErpUpload(arquivo) {
    setErp(arquivo);
    try {
      const { colunas } = await previewColunas(arquivo, 'erp_receber');
      setColunasErp(colunas);
    } catch (e) { console.error(e); }
  }

  async function handleBancoUpload(arquivo) {
    setBanco(arquivo);
    try {
      const { colunas } = await previewColunas(arquivo, 'banco');
      setColunasBanco(colunas);
    } catch (e) { console.error(e); }
  }

  async function handleConciliar() {
    if (!operadora || !erp || !banco) { setErro('Envie os três arquivos antes de conciliar.'); return; }
    setErro('');
    setLoading(true);
    try {
      const res = await conciliarReceitas({ operadora, erp, banco, mapeamentoErp, mapeamentoBanco, periodoMes });
      setResultado(res);
    } catch (e) {
      setErro(e.response?.data?.detail || 'Erro ao processar. Verifique os arquivos.');
    } finally {
      setLoading(false);
    }
  }

  const r = resultado?.resumo;

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Conciliação de Receitas</h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Operadora de cartão vs ERP — Contas a Receber vs Extrato Bancário
      </p>

      {/* Upload 3 fontes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 8 }}>
        <UploadCard titulo="Operadora de Cartão" subtitulo="Stone, Cielo, Rede…" icone={CreditCard}
          arquivo={operadora} onArquivo={setOperadora} />
        <UploadCard titulo="ERP — Contas a Receber" subtitulo="Exportação do ERP" icone={Building2}
          arquivo={erp} onArquivo={handleErpUpload} />
        <UploadCard titulo="Extrato Bancário" subtitulo="Créditos recebidos" icone={Landmark}
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
          style={{ marginTop: 20, padding: '9px 22px', background: '#1A1A2E', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Play size={15} /> {loading ? 'Processando…' : 'Executar Conciliação'}
        </button>
      </div>

      {erro && (
        <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, display: 'flex', gap: 8 }}>
          <AlertTriangle size={16} /> {erro}
        </div>
      )}

      {resultado && r && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total analisado', value: r.total_itens, color: '#378ADD' },
              { label: 'Conciliados', value: r.conciliados, color: '#1D9E75' },
              { label: 'Divergências', value: r.divergencias, color: '#BA7517' },
              { label: 'Ausentes', value: r.ausentes, color: '#E24B4A' },
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
              { label: 'Total ERP', value: `R$ ${r.total_erp?.toFixed(2)}` },
              { label: 'Total banco', value: `R$ ${r.total_banco?.toFixed(2)}` },
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
