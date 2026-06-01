import { useState, useEffect } from 'react';

const COR_PRIMARIA = '#1A1A2E';
const COR_VERDE    = '#1D9E75';

export default function ModalCliente({ aberto, onFechar, onSalvar, clienteInicial }) {
  const [razao_social, setRazaoSocial]   = useState('');
  const [cnpj, setCnpj]                  = useState('');
  const [nome_fantasia, setNomeFantasia] = useState('');
  const [erp_utilizado, setErpUtilizado] = useState('');
  const [loading, setLoading]            = useState(false);
  const [erro, setErro]                  = useState('');

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
  }, [clienteInicial, aberto]);

  if (!aberto) return null;

  async function handleSalvar(e) {
    e.preventDefault();
    if (!razao_social.trim()) { setErro('Razao social e obrigatoria.'); return; }
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

  return (
    <div style={{
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
          <Campo label="Razao Social *" value={razao_social} onChange={setRazaoSocial} placeholder="Empresa Ltda" />
          <Campo label="CNPJ" value={cnpj} onChange={setCnpj} placeholder="00.000.000/0001-00" />
          <Campo label="Nome Fantasia" value={nome_fantasia} onChange={setNomeFantasia} placeholder="Nome comercial" />
          <Campo label="ERP Utilizado" value={erp_utilizado} onChange={setErpUtilizado} placeholder="SAP, TOTVS, Omie..." />

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
              disabled={loading}
              style={{
                background: loading ? '#aaa' : COR_VERDE,
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 24px', fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 13, fontWeight: 600,
        color: '#374151', marginBottom: 6,
      }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', border: '1.5px solid #D1D5DB', borderRadius: 8,
          padding: '10px 12px', fontSize: 14, color: '#111',
          outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
