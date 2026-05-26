export default function MapeadorColunas({ colunas, mapeamento, onChange, campos }) {
  if (!colunas || colunas.length === 0) return null;

  return (
    <div style={{ background: '#F8F8FF', border: '1px solid #E0E0F0', borderRadius: 8, padding: 16, marginTop: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#333' }}>
        🗂️ Mapeamento de colunas do ERP
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {campos.map(({ key, label }) => (
          <div key={key}>
            <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 3 }}>{label}</label>
            <select
              value={mapeamento[key] || ''}
              onChange={e => onChange({ ...mapeamento, [key]: e.target.value })}
              style={{
                width: '100%', padding: '5px 8px', borderRadius: 6,
                border: '1px solid #ddd', fontSize: 12, background: '#fff'
              }}
            >
              <option value="">— Selecionar —</option>
              {colunas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
