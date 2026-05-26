const KEY = 'conciliador_historico';
const MAX_ITEMS = 50;

/**
 * Salva um registro de conciliação no histórico local (localStorage).
 * @param {{ tipo: string, periodo: string, arquivos: object, resumo: object }} entrada
 */
export function salvarHistorico({ tipo, periodo, arquivos, resumo }) {
  const lista = listarHistorico();
  const novo = {
    id: String(Date.now()),
    tipo,
    periodo: periodo || null,
    arquivos: arquivos || {},
    resumo,
    data_execucao: new Date().toISOString(),
  };
  const atualizada = [novo, ...lista].slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(KEY, JSON.stringify(atualizada));
  } catch (_) { /* localStorage cheio */ }
  return novo;
}

/** Retorna array com o histórico completo (mais recente primeiro). */
export function listarHistorico() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

/** Remove uma entrada pelo id. */
export function removerEntrada(id) {
  const lista = listarHistorico().filter(i => i.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(lista)); } catch (_) {}
}

/** Apaga todo o histórico. */
export function limparHistorico() {
  localStorage.removeItem(KEY);
}
