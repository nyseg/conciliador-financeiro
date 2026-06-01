import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 180000, // 3 minutos — comporta cold start do Render + PDFs com OCR
});

// Injeta token JWT em todas as requisições (se disponível)
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------------------------------------------------------------------------
// Funções legadas (conciliação)
// ---------------------------------------------------------------------------
export async function previewColunas(arquivo, tipo) {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  fd.append('tipo', tipo);
  const { data } = await api.post('/api/preview-colunas', fd);
  return data;
}

export async function conciliarDespesas({
  fatura, erp, mapeamento, mapeamentoFatura,
  periodoMes, modoErp, perfilCliente, clienteId,
}) {
  const fd = new FormData();
  fd.append('fatura', fatura);
  fd.append('erp', erp);
  fd.append('mapeamento', JSON.stringify(mapeamento || {}));
  fd.append('mapeamento_fatura', JSON.stringify(mapeamentoFatura || {}));
  fd.append('periodo_mes', periodoMes || '');
  fd.append('modo_erp', modoErp || 'transacao');
  fd.append('perfil_cliente', JSON.stringify(perfilCliente || {}));
  fd.append('cliente_id', clienteId || '');
  const { data } = await api.post('/api/conciliar-despesas', fd);
  return data;
}

export async function conciliarReceitas({
  operadora, erp, banco, mapeamentoErp, mapeamentoBanco, periodoMes, clienteId,
}) {
  const fd = new FormData();
  fd.append('operadora', operadora);
  fd.append('erp', erp);
  fd.append('banco', banco);
  fd.append('mapeamento_erp', JSON.stringify(mapeamentoErp || {}));
  fd.append('mapeamento_banco', JSON.stringify(mapeamentoBanco || {}));
  fd.append('periodo_mes', periodoMes || '');
  fd.append('cliente_id', clienteId || '');
  const { data } = await api.post('/api/conciliar-receitas', fd);
  return data;
}

export async function listarPerfis() {
  const { data } = await api.get('/api/perfis-clientes');
  return data;
}

export async function carregarPerfil(nome) {
  const { data } = await api.get(`/api/perfil-cliente/${encodeURIComponent(nome)}`);
  return data;
}

export async function salvarPerfil(perfil) {
  const { data } = await api.post('/api/perfil-cliente', perfil);
  return data;
}

export async function baixarExcelDoPdf(arquivo) {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  try {
    const resp = await api.post('/api/pdf-para-excel', fd, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([resp.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = arquivo.name.replace(/\.pdf$/i, '_extraido.xlsx');
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    if (e.response?.data instanceof Blob) {
      const texto = await e.response.data.text();
      let detalhe = 'Erro ao converter o PDF.';
      try { detalhe = JSON.parse(texto).detail || detalhe; } catch {}
      throw new Error(detalhe);
    }
    throw e;
  }
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

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------
export async function registrar({ nome, email, senha }) {
  const { data } = await api.post('/api/auth/registro', { nome, email, senha });
  return data;
}

export async function login({ email, senha }) {
  const { data } = await api.post('/api/auth/login', { email, senha });
  return data;
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------
export async function listarClientes() {
  const { data } = await api.get('/api/clientes');
  return data;
}

export async function criarCliente(dados) {
  const { data } = await api.post('/api/clientes', dados);
  return data;
}

export async function obterCliente(id) {
  const { data } = await api.get(`/api/clientes/${id}`);
  return data;
}

export async function atualizarCliente(id, dados) {
  const { data } = await api.put(`/api/clientes/${id}`, dados);
  return data;
}

export async function deletarCliente(id) {
  const { data } = await api.delete(`/api/clientes/${id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Perfil por cliente
// ---------------------------------------------------------------------------
export async function carregarPerfilCliente(id) {
  const { data } = await api.get(`/api/clientes/${id}/perfil`);
  return data;
}

export async function salvarPerfilCliente(id, perfil) {
  const { data } = await api.put(`/api/clientes/${id}/perfil`, perfil);
  return data;
}

// ---------------------------------------------------------------------------
// Histórico de conciliações
// ---------------------------------------------------------------------------
export async function listarConciliacoes(clienteId) {
  const { data } = await api.get(`/api/clientes/${clienteId}/conciliacoes`);
  return data;
}

export async function detalharConciliacao(id) {
  const { data } = await api.get(`/api/conciliacoes/${id}`);
  return data;
}

export async function reexportarConciliacao(id) {
  const resp = await api.post(`/api/conciliacoes/${id}/exportar`, {}, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([resp.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `conciliacao_${id}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
