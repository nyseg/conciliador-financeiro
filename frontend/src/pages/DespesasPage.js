import { useState, useEffect } from 'react';
import { CreditCard, Building2, Download, Play, AlertTriangle } from 'lucide-react';
import UploadCard from '../components/UploadCard';
import MapeadorColunas from '../components/MapeadorColunas';
import TabelaResultado from '../components/TabelaResultado';
import { conciliarDespesas, previewColunas, exportarRelatorio } from '../api';
import { salvarHistorico } from '../utils/historico';

const CAMPOS_ERP = [
  { key: 'data', label: 'Coluna de Data' },
  { key: 'descricao', label: 'Coluna de Descrição' },
  { key: 'valor', label: 'Coluna de Valor Liquidado' },
  { key: 'valor_fallback', label: 'Coluna de Valor da Conta' },
  { key: 'numero_fatura', label: 'Nº da Fatura / Referência' },
  { key: 'status', label: 'Coluna de Status' },
];

export default function DespesasPage() {
  const [fatura, setFatura] = useState(null);
  const [erp, setErp] = useState(null);
  const [periodoMes, setPeriodoMes] = useState('');
  const [colunasErp, setColunasErp] = useState([]);
  const [mapeamento, setMapeamento] = useState({});
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSeg, setLoadingSeg] = useState(0);
  const [erro, setErro] = useState('');

  // Cronômetro de loading — mostra tempo decorrido e alerta após 15s
  useEffect(() => {
    if (!loading) { setLoadingSeg(0); return; }
    setLoadingSeg(0);
    const inicio = Date.now();
    const iv = setInterval(() => setLoadingSeg(Math.round((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  async function handleErpUpload(arquivo) {
    setErp(arquivo);
    try {
      const { colunas } = await previewColunas(arquivo, 'erp_pagar');
      setColunasErp(colunas);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleConciliar() {
    if (!fatura || !erp) { setErro('Envie os dois arquivos antes de conciliar.'); return; }
    setErro('');
    setLoading(true);
    try {
      const res = await conciliarDespesas({ fatura, erp, mapeamento, periodoMes });
      setResultado(res);
      // Salva no histórico local
      salvarHistorico({
        tipo: 'despesas',
        periodo: periodoMes,
        arquivos: { fatura: fatura.name, erp: erp.name },
        resumo: res.resumo,
      });
    } catch (e) {
      setErro(e.response?.data?.detail || 'Erro ao processar. Verifique os arquivos.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Conciliação manual: une idxA (ausente_erp ou ausente_fatura)
   * com idxB (o oposto) em um único item conciliado.
   */
  function handleManualMatch(idxA, idxB) {
    setResultado(prev => {
      const itens = [...prev.itens];
      const a = { ...itens[idxA] };
      const b = { ...itens[idxB] };

      let merged;
      if (a.status === 'ausente_erp') {
        // A tem dados da fatura, B tem dados do ERP
        merged = {
          ...a,
          data_erp: b.data_erp,
          descricao_erp: b.descricao_erp,
          valor_erp: b.valor_erp,
          numero_fatura_erp: b.numero_fatura_erp,
          status_erp: b.status_erp,
          status: 'ok_manual',
        };
      } else {
        // A tem dados do ERP, B tem dados da fatura
        merged = {
          ...a,
          data_fatura: b.data_fatura,
          descricao_fatura: b.descricao_fatura,
          valor_fatura: b.valor_fatura,
          cartao: b.cartao,
          status: 'ok_manual',
        };
      }

      // Substitui A pelo merged, remove B
      const newItens = itens
        .map((item, i) => (i === idxA ? merged : item))
        .filter((_, i) => i !== idxB);

      // Atualiza resumo
      const resumo = { ...prev.resumo };
      if (a.status === 'ausente_erp' || b.status === 'ausente_erp')
        resumo.sem_erp = Math.max(0, (resumo.sem_erp || 0) - 1);
      if (a.status === 'ausente_fatura' || b.status === 'ausente_fatura')
        resumo.sem_fatura = Math.max(0, (resumo.sem_fatura || 0) - 1);
      resumo.conciliados = (resumo.conciliados || 0) + 1;
      resumo.total_itens = newItens.length;

      return { ...prev, itens: newItens, resumo };
    });
  }

  const r = resultado?.resumo;

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Conciliação de Despesas</h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Fatura do cartão corporativo vs ERP — Contas a Pagar &nbsp;
        <span style={{ fontSize: 11, color: '#aaa' }}>Aceita CSV, Excel ou OFX/QFX</span>
      </p>

      {/* Upload */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <UploadCard titulo="Fatura do Cartão" subtitulo="CSV, Excel ou OFX/QFX" icone={CreditCard}
          arquivo={fatura} onArquivo={setFatura} />
        <UploadCard titulo="ERP — Contas a Pagar" subtitulo="CSV ou Excel da exportação" icone={Building2}
          arquivo={erp} onArquivo={handleErpUpload} />
      </div>

      {/* Mapeador */}
      {colunasErp.length > 0 && (
        <MapeadorColunas colunas={colunasErp} mapeamento={mapeamento}
          onChange={setMapeamento} campos={CAMPOS_ERP} />
      )}

      {/* Período e ação */}
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

      {/* Loading com cronômetro */}
      {loading && (
        <div style={{ background: '#F0F7FF', border: '1px solid #BDD4F7', borderRadius: 8, padding: '14px 16px', marginTop: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid #BDD4F7', borderTopColor: '#1A5FA8', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A5FA8' }}>
              Analisando arquivos… {loadingSeg > 0 && <span style={{ fontWeight: 400, color: '#555' }}>{loadingSeg}s</span>}
            </div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
              {loadingSeg < 15
                ? 'Processando os dados — aguarde.'
                : loadingSeg < 35
                ? '⏳ O servidor está acordando do modo de espera, isso leva até 40 segundos…'
                : '🔄 Quase lá! Arquivo grande ou servidor ocupado — continue aguardando.'}
            </div>
          </div>
        </div>
      )}

      {erro && (
        <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, display: 'flex', gap: 8 }}>
          <AlertTriangle size={16} /> {erro}
        </div>
      )}

      {/* Resultado */}
      {resultado && r && (
        <div style={{ marginTop: 24 }}>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total analisado', value: r.total_itens, color: '#378ADD' },
              { label: 'Conciliados', value: r.conciliados, color: '#1D9E75' },
              { label: 'Sem ERP', value: r.sem_erp, color: '#E24B4A' },
              { label: 'Sem fatura', value: r.sem_fatura, color: '#BA7517' },
            ].map(m => (
              <div key={m.label} style={{ background: '#F7F7FB', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Totais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total fatura', value: `R$ ${r.total_fatura?.toFixed(2)}` },
              { label: 'Total ERP', value: `R$ ${r.total_erp?.toFixed(2)}` },
              { label: 'Diferença', value: `R$ ${r.diferenca?.toFixed(2)}`, destaque: r.diferenca !== 0 },
            ].map(m => (
              <div key={m.label} style={{ background: m.destaque ? '#FEF3E2' : '#F7F7FB', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#888' }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: m.destaque ? '#8A4A00' : '#333' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Alerta encargos */}
          {r.total_encargos_pendentes > 0 && (
            <div style={{ background: '#FEF3E2', border: '1px solid #F5D99A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#5A3200' }}>
              ⚠️ <strong>Encargos não lançados no ERP:</strong> R$ {r.total_encargos_pendentes?.toFixed(2)} pendente de lançamento
            </div>
          )}

          {/* Tabela com conciliação manual */}
          <TabelaResultado
            itens={resultado.itens}
            modo="despesas"
            onManualMatch={handleManualMatch}
          />

          {/* Exportar */}
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
