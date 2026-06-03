import { useState, useEffect } from 'react';

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

  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus]     = useState(null);
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

    setBuscandoCnpj(true);
    setCnpjMsg('Consultando Receita Federal...');
    try {
      const dados = await buscarCnpj(formatado);
      const razao    = dados.razao_social || '';
      const fantasia = dados.nome_fantasia || dados.razao_social || '';
      setRazaoSocial(razao);
      setNomeFantasia(fantasia !== razao ? fantasia : '');
      const situacao = dados.descricao_situacao_cadastral || '';
      if (situacao && situacao.toUpperCase() !== 'ATIVA') {
        setCnpjStatus('erro');
        setCnpjMsg(`Situação na Receita: ${situacao}. Verifique antes de prosseguir.`);
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

  const corBordaCnpj = cnpjStatus === 'ok'      ? '#059669'
                     : cnpjStatus === 'erro'     ? '#D97706'
                     : cnpjStatus === 'invalido' ? '#DC2626'
                     : '#E2E8F0';

  const corMsgCnpj = cnpjStatus === 'ok'      ? '#059669'
                   : cnpjStatus === 'invalido' ? '#DC2626'
                   : '#D97706';

  return (
    <div
      style={s.overlay}
      onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div style={s.modal}>
        {/* Header */}
        <div style={s.modalHeader}>
          <h3 style={s.modalTitle}>
            {clienteInicial ? 'Editar Cliente' : 'Novo Cliente'}
          </h3>
          <button onClick={onFechar} style={s.modalClose}>&times;</button>
        </div>

        {/* Body */}
        <div style={s.modalBody}>
          <form onSubmit={handleSalvar}>

            {/* CNPJ */}
            <div style={s.fieldGroup}>
              <label style={s.label}>
                CNPJ
                <span style={s.labelHint}>(preenchimento automático)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  value={cnpj}
                  onChange={e => handleCnpjChange(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  maxLength={18}
                  style={{
                    ...s.input,
                    borderColor: corBordaCnpj,
                    paddingRight: buscandoCnpj ? 40 : 12,
                  }}
                  onFocus={e => { if (!cnpjStatus) { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; } }}
                  onBlur={e => { if (!cnpjStatus) { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; } }}
                />
                {buscandoCnpj && (
                  <span style={s.cnpjSpinner} />
                )}
              </div>
              {cnpjMsg && (
                <div style={{ fontSize: 12, marginTop: 4, color: corMsgCnpj }}>{cnpjMsg}</div>
              )}
            </div>

            {/* Razão Social */}
            <Campo
              label="Razão Social *"
              value={razao_social}
              onChange={setRazaoSocial}
              placeholder="Empresa Ltda"
              destaque={cnpjStatus === 'ok'}
            />

            {/* Nome Fantasia */}
            <Campo
              label="Nome Fantasia"
              value={nome_fantasia}
              onChange={setNomeFantasia}
              placeholder="Nome comercial"
              destaque={cnpjStatus === 'ok'}
            />

            {/* ERP */}
            <Campo
              label="ERP Utilizado"
              value={erp_utilizado}
              onChange={setErpUtilizado}
              placeholder="SAP, TOTVS, Omie..."
            />

            {erro && (
              <div style={s.alertDanger}>{erro}</div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div style={s.modalFooter}>
          <button
            type="button"
            onClick={onFechar}
            style={s.btnCancel}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={loading || buscandoCnpj || cnpjStatus === 'invalido'}
            style={{
              ...s.btnSave,
              background: (loading || buscandoCnpj || cnpjStatus === 'invalido') ? '#94A3B8' : '#2563EB',
              cursor: (loading || buscandoCnpj || cnpjStatus === 'invalido') ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!loading && !buscandoCnpj && cnpjStatus !== 'invalido') e.currentTarget.style.background = '#1D4ED8'; }}
            onMouseLeave={e => { if (!loading && !buscandoCnpj && cnpjStatus !== 'invalido') e.currentTarget.style.background = '#2563EB'; }}
          >
            {buscandoCnpj ? 'Consultando CNPJ...' : loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, destaque }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={s.label}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...s.input,
          borderColor: destaque && value ? '#059669' : '#E2E8F0',
          background: destaque && value ? '#ECFDF5' : '#FFFFFF',
          transition: 'border-color 150ms ease, background 150ms ease',
        }}
        onFocus={e => {
          if (!destaque || !value) {
            e.target.style.borderColor = '#2563EB';
            e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)';
          }
        }}
        onBlur={e => {
          if (!destaque || !value) {
            e.target.style.borderColor = '#E2E8F0';
            e.target.style.boxShadow = 'none';
          }
        }}
      />
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    border: '1px solid #E2E8F0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #E2E8F0',
  },
  modalTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#0F172A',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    cursor: 'pointer',
    color: '#94A3B8',
    lineHeight: 1,
    padding: 0,
    transition: 'color 150ms ease',
  },
  modalBody: {
    padding: '20px 24px',
    overflowY: 'auto',
  },
  modalFooter: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    padding: '16px 24px',
    borderTop: '1px solid #E2E8F0',
    background: '#FAFAFA',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#475569',
    marginBottom: 6,
  },
  labelHint: {
    fontWeight: 400,
    color: '#94A3B8',
    fontSize: 11,
    marginLeft: 6,
  },
  input: {
    width: '100%',
    border: '1.5px solid #E2E8F0',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: '#0F172A',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#FFFFFF',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  },
  cnpjSpinner: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 16,
    height: 16,
    border: '2.5px solid #E2E8F0',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    display: 'block',
  },
  alertDanger: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
  },
  btnCancel: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    color: '#475569',
    transition: 'background 150ms ease',
  },
  btnSave: {
    background: '#2563EB',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'background 150ms ease',
  },
};
