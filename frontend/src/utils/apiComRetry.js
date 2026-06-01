/**
 * Executa uma função de API com retry automático.
 * Em caso de falha de rede (servidor dormindo), tenta novamente
 * até MAX_TENTATIVAS vezes com intervalo crescente.
 *
 * @param {Function} fn          - Função async que faz a chamada de API
 * @param {Function} onProgresso - Callback (tentativa, max) para atualizar UI
 * @returns {Promise}            - Resultado da primeira tentativa bem-sucedida
 */
export async function apiComRetry(fn, onProgresso) {
  const MAX_TENTATIVAS = 4;
  const INTERVALOS_MS  = [0, 10000, 15000, 20000]; // 0s, 10s, 15s, 20s

  let ultimoErro;

  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    if (i > 0) {
      onProgresso?.(i, MAX_TENTATIVAS - 1);
      await new Promise(r => setTimeout(r, INTERVALOS_MS[i]));
    }

    try {
      return await fn();
    } catch (err) {
      ultimoErro = err;

      // Só faz retry em erro de rede (servidor não respondeu)
      // Erros HTTP (4xx, 5xx) têm resposta — não tentar de novo
      const ehErroRede = !err.response;
      if (!ehErroRede) throw err;
    }
  }

  // Esgotou as tentativas — lança o último erro com mensagem clara
  const erro = new Error(
    'O servidor não respondeu após várias tentativas. ' +
    'Verifique sua conexão e aguarde 30 segundos antes de tentar novamente.'
  );
  erro.ehTimeoutServidor = true;
  throw erro;
}
