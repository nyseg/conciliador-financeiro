/**
 * Pre-aquece o servidor Render antes de uma requisição pesada.
 * O Render free dorme após 15 min e retorna 503 SEM headers CORS,
 * o que faz o navegador bloquear a requisição. Esta função espera o
 * servidor acordar antes de liberar a chamada principal.
 */

// Em produção usa o proxy do Vercel (URL relativa → Render); em dev, o backend local.
const BASE_URL = process.env.NODE_ENV === 'production'
  ? ''
  : (process.env.REACT_APP_API_URL || 'http://localhost:8000');

export async function acordarServidor(onProgresso) {
  const MAX_TENTATIVAS = 12;   // até 60 segundos de espera
  const INTERVALO_MS   = 5000; // checa a cada 5s

  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    try {
      // /api/status é proxiado para o Render; confirma que o BACKEND está no ar
      const resp = await fetch(`${BASE_URL}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(6000), // timeout de 6s por tentativa
      });
      if (resp.ok) return true; // backend respondeu 200 OK
    } catch (_) {
      // 503, timeout ou CORS sem headers — servidor ainda dormindo
    }

    onProgresso?.(i + 1, MAX_TENTATIVAS);
    await new Promise(r => setTimeout(r, INTERVALO_MS));
  }

  return false; // não conseguiu acordar no tempo limite
}
