import { useState, useEffect } from 'react';
import { CreditCard, Building2, Download, Play, AlertTriangle, RotateCcw } from 'lucide-react';
import UploadCard from '../components/UploadCard';
import MapeadorColunas from '../components/MapeadorColunas';
import TabelaResultado from '../components/TabelaResultado';
import { conciliarDespesas, previewColunas, exportarRelatorio, baixarExcelDoPdf, listarPerfis, carregarPerfil, salvarPerfil } from '../api';
import { salvarHistorico } from '../utils/historico';
import { acordarServidor } from '../utils/servidor';

const SESSION_KEY = 'resultado_despesas';

const CAMPOS_FATURA = [
  { key: 'data',      label: 'Coluna de Data da Compra' },
  { key: 'descricao', label: 'Coluna de Descrição / Estabelecimento' },
  { key: 'valor',     label: 'Coluna de Valor' },
  { key: 'cartao',    label: 'Coluna do Cartão / Final (opcional)' },
];

const CAMPOS_ERP = [
  { key: 'data',          label: 'Coluna de Data' },
  { key: 'descricao',     label: 'Coluna de Descrição / Fornecedor' },
  { key: 'valor',         label: 'Coluna de Valor Liquidado' },
  { key: 'valor_fallback',label: 'Coluna de Valor da Conta (fallback)' },
  { key: 'numero_fatura', label: 'Nº da Fatura / Referência' },
  { key: 'status',        label: 'Coluna de Status' },
  { key: 'categoria',     label: 'Categoria de Despesa (opcional)' },
];

const MODOS_ERP = [
  { value: 'transacao', label: 'Por Transação',  desc: 'ERP tem uma linha por compra/fornecedor' },
  { value: 'categoria', label: 'Por Categoria',  desc: 'ERP agrupa despesas por tipo (combustível, alimentação…)' },
  { value: 'misto',     label: 'Misto',          desc: 'Tenta por transação primeiro, depois por categoria' },
];

export default function DespesasPage({ setProcessando, clienteId }) {
  const [fatura, setFatura]               = useState(null);
  const [erp, setErp]                     = useState(null);
  const [periodoMes, setPeriodoMes]       = useState('');
  const [modoErp, setModoErp]             = useState('transacao');

  const [colunasFatura, setColunasFatura] = useState([]);
  const [colunasErp, setColunasErp]       = useState([]);
  const [mapeamentoFatura, setMapeamentoFatura] = useState({});
  const [mapeamento, setMapeamento]       = useState({});

  const [resultado, setResultado]         = useState(null);
  const [loading, setLoading]             = useState(false);
  const [loadingSeg, setLoadingSeg]       = useState(0);
  const [acordando, setAcordando]         = useState(false);
  const [acordandoTent, setAcordandoTent] = useState(0);
  const [erro, setErro]                   = useState('');
  const [baixandoExcel, setBaixandoExcel] = useState(false);

  const [perfil, setPerfil]                         = useState({ tolerancia_dias: 5, cenario_parcelamento: 'B' });
  const [clientes, setClientes]                     = useState([]);
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [salvandoPerfil, setSalvandoPerfil]         = useState(false);
  const [painelPerfilAberto, setPainelPerfilAberto] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) setResultado(JSON.parse(saved));
    } catch (_) {}
    listarPerfis().then(d => setClientes(d.perfis || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) { setLoadingSeg(0); return; }
    setLoadingSeg(0);
    const inicio = Date.now();
    const iv = setInterval(() => setLoadingSeg(Math.round((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  async function handleFaturaUpload(arquivo) {
    setFatura(arquivo);
    setColunasFatura([]);
    setMapeamentoFatura({});
    try {
      const { colunas } = await previewColunas(arquivo, 'erp_pagar');
      setColunasFatura(colunas);
    } catch (e) { console.error(e); }
  }

  async function handleBaixarExcel() {
    if (!fatura) return;
    setBaixandoExcel(true);
    setErro('');
    try {
      await baixarExcelDoPdf(fatura);
    } catch (e) {
      const msg = e.message || e.response?.data?.detail || 'Erro ao converter o PDF.';
      setErro(msg);
    } finally {
      setBaixandoExcel(false);
    }
  }

  async function handleErpUpload(arquivo) {
    setErp(arquivo);
    try {
      const { colunas } = await previewColunas(arquivo, 'erp_pagar');
      setColunasErp(colunas);
    } catch (e) { console.error(e); }
  }

  async function handleConciliar() {
    if (!fatura || !erp) { setErro('Envie os dois arquivos antes de conciliar.'); return; }
    setErro('');
    setProcessando?.('despesas');

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
      const faturaEhPdfImagem = fatura.name.toLowerCase().endsWith('.pdf') && colunasFatura.length === 0;
      const res = await conciliarDespesas({
        fatura, erp, mapeamento,
        mapeamentoFatura: faturaEhPdfImagem ? {} : mapeamentoFatura,
        periodoMes, modoErp,
        perfilCliente: perfil,
        clienteId: clienteId || '',
      });
      setResultado(res);
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(res)); } catch (_) {}
      salvarHistorico({
        tipo: 'despesas',
        periodo: periodoMes,
        arquivos: { fatura: fatura.name, erp: erp.name },
        resumo: res.resumo,
      });
    } catch (e) {
      if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
        setErro('O servidor demorou mais de 2 minutos. Clique em Executar novamente — agora será rápido.');
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
    setFatura(null); setErp(null);
    setColunasFatura([]); setColunasErp([]);
    setMapeamentoFatura({}); setMapeamento({});
    setPeriodoMes(''); setErro('');
    setBaixandoExcel(false);
  }

  function handleManualMatch(idxA, idxB) {
    setResultado(prev => {
      const itens = [...prev.itens];
      const a = { ...itens[idxA] };
      const b = { ...itens[idxB] };

      let merged;
      if (a.status === 'ausente_erp') {
        merged = { ...a, data_erp: b.data_erp, descricao_erp: b.descricao_erp, valor_erp: b.valor_erp,
                   numero_fatura_erp: b.numero_fatura_erp, status_erp: b.status_erp, status: 'ok_manual' };
      } else {
        merged = { ...a, data_fatura: b.data_fatura, descricao_fatura: b.descricao_fatura,
                   valor_fatura: b.valor_fatura, cartao: b.cartao, status: 'ok_manual' };
      }

      const newItens = itens.map((item, i) => i === idxA ? merged : item).filter((_, i) => i !== idxB);
      const resumo = { ...prev.resumo };
      if (a.status === 'ausente_erp'    || b.status === 'ausente_erp')    resumo.sem_erp    = Math.max(0, (resumo.sem_erp    || 0) - 1);
      if (a.status === 'ausente_fatura' || b.status === 'ausente_fatura') resumo.sem_fatura = Math.max(0, (resumo.sem_fatura || 0) - 1);
      resumo.conciliados = (resumo.conciliados || 0) + 1;
      resumo.total_itens = newItens.length;

      const updated = { ...prev, itens: newItens, resumo };
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
  }

  const r = resultado?.resumo;

  return (
    <div>
      {/* Título */}
      <div className="resp-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h2 style={s.pageTitle}>Conciliação de Despesas</h2>
          <p style={s.pageSubtitle}>
            Fatura do cartão corporativo vs ERP — Contas a Pagar &nbsp;
            <span style={s.pageHint}>Aceita CSV, Excel, OFX/QFX ou PDF</span>
          </p>
        </div>
        {resultado && (
          <button onClick={handleLimpar} style={s.btnSecondary}>
            <RotateCcw size={12} /> Nova análise
          </button>
        )}
      </div>

      {/* Painel Perfil do Cliente */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => setPainelPerfilAberto(v => !v)}
          style={s.btnPerfil}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#CBD5E1'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
        >
          ⚙️ Perfil do cliente {painelPerfilAberto ? '▲' : '▼'}
        </button>
        {painelPerfilAberto && (
          <div style={s.perfilPanel}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={s.perfilLabel}>Cliente existente</label>
                <select
                  value={clienteSelecionado}
                  onChange={async e => {
                    const nome = e.target.value;
                    setClienteSelecionado(nome);
                    if (nome && nome !== '__novo__') {
                      try {
                        const p = await carregarPerfil(nome);
                        setPerfil(p);
                      } catch (_) {}
                    } else if (nome === '__novo__') {
                      setPerfil({ tolerancia_dias: 5, cenario_parcelamento: 'B' });
                    }
                  }}
                  style={s.perfilSelect}
                >
                  <option value="">— Selecionar —</option>
                  <option value="__novo__">— Novo cliente —</option>
                  {clientes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={s.perfilLabel}>Nome do cliente</label>
                <input
                  value={perfil.nome_cliente || ''}
                  onChange={e => setPerfil(p => ({ ...p, nome_cliente: e.target.value }))}
                  placeholder="Ex: Empresa X"
                  style={s.perfilInput}
                />
              </div>
              <div>
                <label style={s.perfilLabel}>Cenário de parcelamento</label>
                <select
                  value={perfil.cenario_parcelamento || 'B'}
                  onChange={e => setPerfil(p => ({ ...p, cenario_parcelamento: e.target.value }))}
                  style={s.perfilSelect}
                >
                  <option value="A">A — ERP tem campo de parcela</option>
                  <option value="B">B — ERP tem valor da competência</option>
                  <option value="C">C — ERP lançou o total</option>
                </select>
              </div>
              <div>
                <label style={s.perfilLabel}>Tolerância de dias</label>
                <input
                  type="number" min={0} max={30}
                  value={perfil.tolerancia_dias ?? 5}
                  onChange={e => setPerfil(p => ({ ...p, tolerancia_dias: parseInt(e.target.value) || 0 }))}
                  style={s.perfilInput}
                />
              </div>
              <div>
                <label style={s.perfilLabel}>Coluna forma de pagamento no ERP</label>
                <input
                  value={perfil.campo_forma_pagamento || ''}
                  onChange={e => setPerfil(p => ({ ...p, campo_forma_pagamento: e.target.value }))}
                  placeholder="Ex: Forma de Pagamento"
                  style={s.perfilInput}
                />
              </div>
              <div>
                <label style={s.perfilLabel}>Valor que identifica cartão no ERP</label>
                <input
                  value={perfil.valor_forma_pagamento || ''}
                  onChange={e => setPerfil(p => ({ ...p, valor_forma_pagamento: e.target.value }))}
                  placeholder="Ex: CARTÃO CRÉDITO"
                  style={s.perfilInput}
                />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!perfil.nome_cliente) { alert('Informe o nome do cliente antes de salvar.'); return; }
                setSalvandoPerfil(true);
                try {
                  await salvarPerfil(perfil);
                  const d = await listarPerfis();
                  setClientes(d.perfis || []);
                  setClienteSelecionado(perfil.nome_cliente);
                } catch (e) {
                  alert('Erro ao salvar perfil: ' + (e.message || ''));
                } finally {
                  setSalvandoPerfil(false);
                }
              }}
              disabled={salvandoPerfil}
              style={{
                ...s.btnSalvarPerfil,
                opacity: salvandoPerfil ? 0.7 : 1,
                cursor: salvandoPerfil ? 'not-allowed' : 'pointer',
              }}
            >
              {salvandoPerfil ? 'Salvando…' : '💾 Salvar perfil'}
            </button>
          </div>
        )}
      </div>

      {/* Upload cards */}
      <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <UploadCard titulo="Fatura do Cartão" subtitulo="CSV, Excel, OFX/QFX ou PDF" icone={CreditCard}
          arquivo={fatura} onArquivo={handleFaturaUpload} />
        <UploadCard titulo="ERP — Contas a Pagar" subtitulo="CSV, Excel ou PDF" icone={Building2}
          arquivo={erp} onArquivo={handleErpUpload} />
      </div>

      {/* PDF imagem info */}
      {fatura && fatura.name.toLowerCase().endsWith('.pdf') && colunasFatura.length === 0 && (
        <div style={s.infoBox}>
          <CreditCard size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>PDF detectado</strong> — as transações serão extraídas automaticamente via OCR.<br />
            <span style={{ color: '#475569', fontSize: 11 }}>
              Ou baixe o Excel extraído para revisar/editar antes de usar como fatura.
            </span>
          </div>
          <button
            onClick={handleBaixarExcel}
            disabled={baixandoExcel}
            style={{
              ...s.btnExtrair,
              opacity: baixandoExcel ? 0.7 : 1,
              cursor: baixandoExcel ? 'not-allowed' : 'pointer',
            }}
          >
            {baixandoExcel
              ? <><div style={s.miniSpinner} /> Extraindo…</>
              : '📥 Baixar como Excel'}
          </button>
        </div>
      )}

      {/* Mapeador da fatura */}
      {!(fatura && fatura.name.toLowerCase().endsWith('.pdf') && colunasFatura.length === 0) && colunasFatura.length > 0 ? (
        <div style={{ marginBottom: 4 }}>
          <div style={s.mapperLabel}>
            <CreditCard size={13} /> Mapeamento da Fatura do Cartão
          </div>
          <MapeadorColunas colunas={colunasFatura} mapeamento={mapeamentoFatura}
            onChange={setMapeamentoFatura} campos={CAMPOS_FATURA} />
        </div>
      ) : null}

      {/* Mapeador do ERP */}
      {colunasErp.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ ...s.mapperLabel, color: '#475569' }}>
            <Building2 size={13} /> Mapeamento do ERP
          </div>
          <MapeadorColunas colunas={colunasErp} mapeamento={mapeamento}
            onChange={setMapeamento} campos={CAMPOS_ERP} />
        </div>
      )}

      {/* Controles */}
      <div className="resp-controls" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={s.controlLabel}>Período (opcional)</label>
          <input
            type="month"
            value={periodoMes}
            onChange={e => setPeriodoMes(e.target.value)}
            style={s.controlInput}
          />
        </div>

        <div>
          <label style={s.controlLabel}>Como o ERP está estruturado?</label>
          <select
            value={modoErp}
            onChange={e => setModoErp(e.target.value)}
            style={{ ...s.controlInput, minWidth: 200 }}
          >
            {MODOS_ERP.map(m => (
              <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleConciliar}
          disabled={loading}
          style={{
            ...s.btnExecutar,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1D4ED8'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#2563EB'; }}
        >
          {loading
            ? <><div style={s.miniSpinner} /> Processando…</>
            : <><Play size={15} /> Executar Conciliação</>}
        </button>
      </div>

      {/* Acordando */}
      {acordando && (
        <div style={s.alertWarning}>
          <div style={{ ...s.miniSpinner, borderColor: '#FDE68A', borderTopColor: '#D97706', width: 22, height: 22, border: '3px solid #FDE68A', borderTopColor: '#D97706' }} />
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
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid #BFDBFE', borderTopColor: '#2563EB', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E40AF' }}>
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
          {/* Cards de resumo — border-left colorida */}
          <div className="resp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Total analisado', value: r.total_itens,  borderColor: '#2563EB', numColor: '#0F172A' },
              { label: 'Conciliados',     value: r.conciliados,  borderColor: '#059669', numColor: '#059669' },
              { label: 'Sem ERP',         value: r.sem_erp,      borderColor: '#DC2626', numColor: '#DC2626' },
              { label: 'Sem fatura',      value: r.sem_fatura,   borderColor: '#D97706', numColor: '#D97706' },
            ].map(m => (
              <div key={m.label} style={{ ...s.statCard, borderLeftColor: m.borderColor }}>
                <div style={s.statLabel}>{m.label}</div>
                <div style={{ ...s.statNum, color: m.numColor }}>{m.value}</div>
              </div>
            ))}
          </div>

          {(r.parcelas_detectadas > 0 || r.agrupados_categoria > 0) && (
            <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 14 }}>
              {r.parcelas_detectadas > 0 && (
                <div style={{ ...s.statCard, borderLeftColor: '#2563EB', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>📋</span>
                  <div>
                    <div style={s.statLabel}>Parcelas detectadas e conciliadas</div>
                    <div style={{ ...s.statNum, color: '#2563EB' }}>{r.parcelas_detectadas}</div>
                  </div>
                </div>
              )}
              {r.agrupados_categoria > 0 && (
                <div style={{ ...s.statCard, borderLeftColor: '#059669', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>📦</span>
                  <div>
                    <div style={s.statLabel}>Itens conciliados por categoria</div>
                    <div style={{ ...s.statNum, color: '#059669' }}>{r.agrupados_categoria}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="resp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total fatura', value: `R$ ${r.total_fatura?.toFixed(2)}`, destaque: false },
              { label: 'Total ERP',    value: `R$ ${r.total_erp?.toFixed(2)}`,    destaque: false },
              { label: 'Diferença',    value: `R$ ${r.diferenca?.toFixed(2)}`,    destaque: r.diferenca !== 0 },
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

          {r.total_encargos_pendentes > 0 && (
            <div style={{ ...s.alertWarning, marginBottom: 16 }}>
              <strong>Encargos não lançados no ERP:</strong> R$ {r.total_encargos_pendentes?.toFixed(2)}
            </div>
          )}

          {r.validacao_agrupamento && (
            <div style={{
              background: r.validacao_agrupamento.ok ? '#ECFDF5' : '#FEF2F2',
              border: `1px solid ${r.validacao_agrupamento.ok ? '#A7F3D0' : '#FECACA'}`,
              borderRadius: 8, padding: '12px 16px', marginBottom: 16
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: r.validacao_agrupamento.ok ? '#059669' : '#DC2626' }}>
                {r.validacao_agrupamento.ok ? '✅ Agrupamento correto — pode realizar o pagamento' : '❌ Agrupamento com diferença — revisar lançamentos'}
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                Valor líquido da fatura: R$ {r.valor_liquido?.toFixed(2)}
                {' | '}Total ERP agrupado: R$ {r.validacao_agrupamento.total_erp_agrupado?.toFixed(2)}
                {!r.validacao_agrupamento.ok && ` | Diferença: R$ ${r.validacao_agrupamento.diferenca?.toFixed(2)}`}
              </div>
              {(r.total_pagamentos > 0 || r.total_antecipacoes > 0) && (
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                  {r.total_pagamentos > 0 && `Pagamentos abatidos: R$ ${r.total_pagamentos?.toFixed(2)} `}
                  {r.total_antecipacoes > 0 && `| Antecipações: R$ ${r.total_antecipacoes?.toFixed(2)}`}
                </div>
              )}
            </div>
          )}

          <TabelaResultado itens={resultado.itens} modo="despesas" onManualMatch={handleManualMatch} />

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <button
              onClick={() => exportarRelatorio(resultado)}
              style={s.btnExportar}
              onMouseEnter={e => { e.currentTarget.style.background = '#047857'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#059669'; }}
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
  btnPerfil: {
    background: 'none',
    border: '1px solid #E2E8F0',
    borderRadius: 7,
    padding: '7px 14px',
    fontSize: 12,
    color: '#475569',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'border-color 150ms ease',
  },
  perfilPanel: {
    marginTop: 8,
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    padding: '14px 16px',
  },
  perfilLabel: {
    fontSize: 11,
    color: '#94A3B8',
    display: 'block',
    marginBottom: 4,
    fontWeight: 500,
  },
  perfilSelect: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #E2E8F0',
    fontSize: 12,
    fontFamily: 'inherit',
    background: '#FFFFFF',
    color: '#0F172A',
  },
  perfilInput: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #E2E8F0',
    fontSize: 12,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#FFFFFF',
    color: '#0F172A',
  },
  btnSalvarPerfil: {
    padding: '7px 16px',
    background: '#2563EB',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
  },
  infoBox: {
    background: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 8,
    fontSize: 12,
    color: '#1E40AF',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
  },
  btnExtrair: {
    padding: '6px 14px',
    background: '#059669',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    whiteSpace: 'nowrap',
  },
  mapperLabel: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: 600,
    marginBottom: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
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
    background: '#2563EB',
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
    background: '#EFF6FF',
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
    background: '#059669',
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
