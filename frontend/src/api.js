import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 minutos — comporta cold start do Render + arquivos grandes
});

export async function previewColunas(arquivo, tipo) {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  fd.append('tipo', tipo);
  const { data } = await api.post('/api/preview-colunas', fd);
  return data;
}

export async function conciliarDespesas({ fatura, erp, mapeamento, periodoMes, modoErp }) {
  const fd = new FormData();
  fd.append('fatura', fatura);
  fd.append('erp', erp);
  fd.append('mapeamento', JSON.stringify(mapeamento || {}));
  fd.append('periodo_mes', periodoMes || '');
  fd.append('modo_erp', modoErp || 'transacao');
  const { data } = await api.post('/api/conciliar-despesas', fd);
  return data;
}

export async function conciliarReceitas({ operadora, erp, banco, mapeamentoErp, mapeamentoBanco, periodoMes }) {
  const fd = new FormData();
  fd.append('operadora', operadora);
  fd.append('erp', erp);
  fd.append('banco', banco);
  fd.append('mapeamento_erp', JSON.stringify(mapeamentoErp || {}));
  fd.append('mapeamento_banco', JSON.stringify(mapeamentoBanco || {}));
  fd.append('periodo_mes', periodoMes || '');
  const { data } = await api.post('/api/conciliar-receitas', fd);
  return data;
}

export async function exportarRelatorio(payload) {
  const resp = await api.post('/api/exportar', payload, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([resp.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'conciliacao.xlsx';
  a.click();
  window.URL.revokeObjectURL(url);
}
