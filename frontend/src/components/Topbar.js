import { useLocation, Link } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Mapa de rótulos por segmento de rota
const LABELS = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
};

function montarTrilha(pathname) {
  const partes = pathname.split('/').filter(Boolean);
  const trilha = [{ label: 'Início', to: '/dashboard' }];
  let acc = '';
  partes.forEach((seg, i) => {
    acc += `/${seg}`;
    // id de cliente (uuid) → rótulo genérico
    const label = LABELS[seg] || (i > 0 && partes[i - 1] === 'clientes' ? 'Cliente' : seg);
    trilha.push({ label, to: acc });
  });
  return trilha;
}

export default function Topbar() {
  const { pathname } = useLocation();
  const { analista } = useAuth();
  const trilha = montarTrilha(pathname);

  const inicial = (analista?.nome || '?').trim().charAt(0).toUpperCase();

  return (
    <header style={s.topbar}>
      {/* Breadcrumb */}
      <div style={s.trilha}>
        {trilha.map((parte, i) => {
          const ultimo = i === trilha.length - 1;
          return (
            <span key={parte.to} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <span style={s.sep}>›</span>}
              {ultimo
                ? <span style={s.trilhaAtual}>{parte.label}</span>
                : <Link to={parte.to} style={s.trilhaLink}>{parte.label}</Link>}
            </span>
          );
        })}
      </div>

      {/* Ações */}
      <div style={s.acoes}>
        <div style={s.buscaWrap}>
          <Search size={15} style={s.buscaIcon} />
          <input style={s.busca} placeholder="Buscar clientes, conciliações…" />
        </div>

        <button style={s.btnSino} title="Notificações">
          <Bell size={17} />
          <span style={s.pontoSino} />
        </button>

        <div style={s.usuario}>
          <div style={s.avatar}>{inicial}</div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={s.usuarioNome}>{analista?.nome || 'Usuário'}</div>
            <div style={s.usuarioEmail}>{analista?.email || ''}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

const s = {
  topbar: {
    position: 'fixed', top: 0, left: 240, right: 0, height: 56,
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', zIndex: 150,
  },
  trilha: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  sep: { color: 'var(--text-3)' },
  trilhaLink: { color: 'var(--text-3)', textDecoration: 'none' },
  trilhaAtual: { color: 'var(--text-1)', fontWeight: 600 },
  acoes: { display: 'flex', alignItems: 'center', gap: 14 },
  buscaWrap: { position: 'relative' },
  buscaIcon: {
    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-3)', pointerEvents: 'none',
  },
  busca: {
    border: '1px solid var(--border)', borderRadius: 8,
    padding: '7px 12px 7px 32px', fontSize: 12.5, width: 280,
    outline: 'none', fontFamily: 'inherit', color: 'var(--text-1)',
    background: 'var(--bg)',
  },
  btnSino: {
    position: 'relative', background: 'transparent', border: 'none',
    cursor: 'pointer', color: 'var(--text-2)', padding: 6,
    display: 'flex', alignItems: 'center',
  },
  pontoSino: {
    position: 'absolute', top: 4, right: 4, width: 7, height: 7,
    borderRadius: '50%', background: 'var(--accent)',
  },
  usuario: { display: 'flex', alignItems: 'center', gap: 9 },
  avatar: {
    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
    background: 'var(--ice)', color: 'var(--primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-serif)', fontSize: 16,
  },
  usuarioNome: { fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)' },
  usuarioEmail: { fontSize: 11, color: 'var(--text-3)' },
};
