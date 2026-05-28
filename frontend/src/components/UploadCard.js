import { useRef } from 'react';
import { Upload, CheckCircle } from 'lucide-react';

export default function UploadCard({ titulo, subtitulo, icone: Icone, arquivo, onArquivo }) {
  const ref = useRef();

  return (
    <div
      onClick={() => ref.current.click()}
      style={{
        border: arquivo ? '1.5px solid #1D9E75' : '1.5px dashed #ccc',
        borderRadius: 10,
        padding: '20px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        background: arquivo ? '#F0FBF6' : '#FAFAFA',
        transition: 'all .15s',
      }}
    >
      <input ref={ref} type="file" accept=".csv,.xlsx,.xls,.ofx,.qfx,.pdf" style={{ display: 'none' }}
        onChange={e => e.target.files[0] && onArquivo(e.target.files[0])} />

      {arquivo
        ? <CheckCircle size={26} color="#1D9E75" />
        : Icone ? <Icone size={26} color="#999" /> : <Upload size={26} color="#999" />
      }

      <div style={{ fontWeight: 600, fontSize: 13, marginTop: 8, color: arquivo ? '#0F6E56' : '#333' }}>
        {titulo}
      </div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
        {arquivo ? arquivo.name : subtitulo}
      </div>
    </div>
  );
}
