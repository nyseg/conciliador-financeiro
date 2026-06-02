import { useState, useEffect } from 'react';

const COR_PRIMARIA = '#1A1A2E';
const COR_VERDE    = '#1D9E75';

// ── Formata e valida CNPJ ────────────────────────────────────────────────────

function formatarCnpj(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2)  return d;
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function cnpjSoDigitos(cnpj) {
  return cnpj.replace(/\D/g, '');
}

function validarCnpj(cnpj) {
  const d = cnpjSoDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (s, n) => {
    let soma = 0, pos = n - 7;
    for (let i = s.length - 1; i >= 0; i--) {
      soma += parseInt(s[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return (
    calc(d.slice(0, 12), 5) === parseInt(d[12]) &&
    calc(d.slice(0, 13), 6) === parseInt(d[13])
  );
}

// ── Busca CNPJ na BrasilAPI ──────────────────────────────────────────────────

async function buscarCnpj(cnpj) {
  const digits = cnpjSoDigitos(cnpj);
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
  if (!res.ok) throw new Error('CNPJ não encontrado na Receita Federal');
  return res.json();
}

// ── Modal ────────────────────────────────────────────────────────────────────

export default function ModalCliente({ aberto, onFechar, onSalvar, clienteInicial }) {
  const [razao_social, setRazaoSocial]   = useState('');
  const [cnpj, setCnpj]                  = useState('');
  const [nome_fantasia, setNomeFantasia] = useState('');
  const [erp_utilizado, setErpUtilizado] = useState('');
  const [loading, setLoading]            = useState(false);
  const [erro, setErro]                  = useState('');

  // Estados da busca de CNPJ
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus]     = useState(null); // null | 'ok' | 'erro' | 'invalido'
  const [cnpjMsg, setCnpjMsg]           = useState('');

  useEffect(() => {
    if (clienteInicial) {
      setRazaoSocial(clienteInicial.razao_social || '');
      setCnpj(clienteInicial.cnpj || '');
      setNomeFantasia(clienteInicial.nome_fantasia || '');
      setErpUtilizado(clienteInicial.erp_utilizado || '');
    } else {
      setRazaoSocial('');
      setCnpj('');
      setNomeFantasia('');
      setErpUtilizado('');
    }
    setErro('');
    setCnpjStatus(null);
    setCnpjMsg('');
  }, [clienteInicial, aberto]);

  if (!aberto) return null;

  // Dispara busca quando CNPJ fica completo
  async function handleCnpjChange(valor) {
    const formatado = formatarCnpj(valor);
    setCnpj(formatado);
    setCnpjStatus(null);
    setCnpjMsg('');

    const digits = cnpjSoDigitos(formatado);
    if (digits.length < 14) return;

    if (!validarCnpj(formatado)) {
      setCnpjStatus('invalido');
      setCnpjMsg('CNPJ inválido — verifique os dígitos');
      return;
    }

    // CNPJ completo e válido → busca automática
    setBuscandoCnpj(true);
    setCnpjMsg('Consultando Receita Federal...');
    try {
      const dados = await buscarCnpj(formatado);

      const razao  = dados.razao_social || '';
      const fantasia = dados.nome_fantasia || dados.razao_social || '';

      setRazaoSocial(razao);
      setNomeFantasia(fantasia !== razao ? fantasia : '');

      const situacao = dados.descricao_situacao_cadastral || '';
      if (situacao && situacao.toUpperCase() !== 'ATIVA') {
        setCnpjStatus('erro');
        setCnpjMsg(`⚠️ Situação na Receita: ${situacao}. Verifique antes de prosseguir.`);
      } else {
        setCnpjStatus('ok');
        setCnpjMsg(`✓ ${razao}`);
      }
    } catch (e) {
      setCnpjStatus('erro');
      setCnpjMsg(e.message || 'Erro ao consultar CNPJ');
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function handleSalvar(e) {
    e.preventDefault();
    if (!razao_social.trim()) { setErro('Razão social é obrigatória.'); return; }
    if (cnpj && cnpjStatus === 'invalido') { setErro('Corrija o CNPJ antes de salvar.'); return; }
    setLoading(true);
    setErro('');
    try {
      await onSalvar({ razao_social, cnpj, nome_fantasia, erp_utilizado });
      onFechar();
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao salvar cliente.');
    } finally {
      setLoading(false);
    }
  }

  const corBordaCnpj = cnpjStatus === 'ok'      ? COR_VERDE
                     : cnpjStatus === 'erro'     ? '#F59E0B'
                     : cnpjStatus === 'invalido' ? '#EF4444'
                     : '#D1D5DB';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, padding: '32px 36px',
        width: '100%', maxWidth: 480,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }}>
        <h3 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700, color: COR_PRIMARIA }}>
          {clienteInicial ? 'Editar Cliente' : 'Novo Cliente'}
        </h3>

        <form onSubmit={handleSalvar}>

          {/* ── CNPJ com busca automática ── */}
          <div style={{ marginBottom: 14 }}>
            <label style={estiloLabel}>
              CNPJ
              <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: 11, marginLeft: 6 }}>
                (preenchimento automático)
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={cnpj}
                onChange={e => handleCnpjChange(e.target.value)}
                placeholder="00.000.000/0001-00"
                maxLength={18}
                style={{
                  ...estiloInput,
                  borderColor: corBordaCnpj,
                  paddingRight: buscandoCnpj ? 40 : 12,
                }}
              />
              {buscandoCnpj && (
                <span style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  width: 16, height: 16, border: '2.5px solid #D1D5DB',
                  borderTopColor: COR_VERDE, borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite', display: 'block',
                }} />
              )}
            </div>
            {cnpjMsg && (
              <div style={{
                fontSize: 12, marginTop: 4,
                color: cnpjStatus === 'ok' ? COR_VERDE : cnpjStatus === 'invalido' ? '#EF4444' : '#B45309',
              }}>
                {cnpjMsg}
              </div>
            )}
          </div>

          {/* ── Razão Social ── */}
          <Campo
            label="Razão Social *"
            value={razao_social}
            onChange={setRazaoSocial}
            placeholder="Empresa Ltda"
            destaque={cnpjStatus === 'ok'}
          />

          {/* ── Nome Fantasia ── */}
          <Campo
            label="Nome Fantasia"
            value={nome_fantasia}
            onChange={setNomeFantasia}
            placeholder="Nome comercial"
            destaque={cnpjStatus === 'ok'}
          />

          {/* ── ERP ── */}
          <Campo
            label="ERP Utilizado"
            value={erp_utilizado}
            onChange={setErpUtilizado}
            placeholder="SAP, TOTVS, Omie..."
          />

          {erro && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              color: '#DC2626', borderRadius: 8, padding: '10px 14px',
              fontSize: 13, marginBottom: 16,
            }}>
              {erro}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              onClick={onFechar}
              style={{
                background: '#F3F4F6', border: 'none', borderRadius: 8,
                padding: '10px 20px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', color: '#374151',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || buscandoCnpj || cnpjStatus === 'invalido'}
              style={{
                background: (loading || buscandoCnpj || cnpjStatus === 'invalido') ? '#9CA3AF' : COR_VERDE,
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 24px', fontSize: 14, fontWeight: 700,
                cursor: (loading || buscandoCnpj || cnpjStatus === 'invalido') ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {buscandoCnpj ? 'Consultando CNPJ...' : loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, destaque }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={estiloLabel}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...estiloInput,
          borderColor: destaque && value ? '#1D9E75' : '#D1D5DB',
          background: destaque && value ? '#F0FBF6' : '#fff',
          transition: 'border-color .2s, background .2s',
        }}
      />
    </div>
  );
}

const estiloLabel = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: '#374151', marginBottom: 6,
};

const estiloInput = {
  width: '100%', border: '1.5px solid #D1D5DB', borderRadius: 8,
  padding: '10px 12px', fontSize: 14, color: '#111',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color .2s',
};
