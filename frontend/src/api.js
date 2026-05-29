import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 180000, // 3 minutos — comporta cold start do Render + PDFs com OCR
});

export async function previewColunas(arquivo, tipo) {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  fd.append('tipo', tipo);
  const { data } = await api.post('/api/preview-colunas', fd);
  return data;
}

export async function conciliarDespesas({ fatura, erp, mapeamento, mapeamentoFatura, periodoMes, modoErp }) {
  const fd = new FormData();
  fd.append('fatura', fatura);
  fd.append('erp', erp);
  fd.append('mapeamento', JSON.stringify(mapeamento || {}));
  fd.append('mapeamento_fatura', JSON.stringify(mapeamentoFatura || {}));
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

export async function baixarExcelDoPdf(arquivo) {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  const resp = await api.post('/api/pdf-para-excel', fd, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([resp.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo.name.replace(/\.pdf$/i, '_extraido.xlsx');
  a.click();
  window.URL.revokeObjectURL(url);
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
