import { NavLink } from 'react-router-dom';
import { LayoutGrid, Users, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  {
    secao: 'Geral',
    itens: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
      { to: '/clientes',  label: 'Clientes',  icon: Users },
    ],
  },
];

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside style={s.sidebar}>
      {/* Marca */}
      <div style={s.brand}>
        <div style={s.logoMark}>F</div>
        <div>
          <div style={s.logoName}>Fincil</div>
          <div style={s.logoTag}>Conciliação Financeira</div>
        </div>
      </div>

      {/* Navegação */}
      <nav style={s.nav}>
        {NAV.map(grupo => (
          <div key={grupo.secao} style={s.secao}>
            <div style={s.secaoLabel}>{grupo.secao}</div>
            {grupo.itens.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={({ isActive }) => ({
                    ...s.item,
                    ...(isActive ? s.itemAtivo : {}),
                  })}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span style={s.barraAtiva} />}
                      <Icon size={18} style={{ flexShrink: 0 }} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Rodapé */}
      <div style={s.rodape}>
        <button style={s.btnSair} onClick={logout}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
          <LogOut size={17} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

const s = {
  sidebar: {
    position: 'fixed', left: 0, top: 0, bottom: 0, width: 240,
    background: 'var(--primary-d)',
    display: 'flex', flexDirection: 'column',
    zIndex: 200,
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '16px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  logoMark: {
    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
    background: 'linear-gradient(135deg, #2558A8, #5A9EFF)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-serif)', fontSize: 20, color: '#fff',
  },
  logoName: {
    fontFamily: 'var(--font-serif)', fontSize: 20, color: '#fff', lineHeight: 1.1,
  },
  logoTag: {
    fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.35)', marginTop: 1,
  },
  nav: { flex: 1, padding: '14px 10px', overflowY: 'auto' },
  secao: { marginBottom: 18 },
  secaoLabel: {
    fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.3)', padding: '0 10px', marginBottom: 8,
  },
  item: {
    position: 'relative',
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '10px 12px', borderRadius: 8,
    color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
    fontSize: 13, fontWeight: 400,
    transition: 'background 150ms ease, color 150ms ease',
    marginBottom: 2,
  },
  itemAtivo: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff', fontWeight: 500,
  },
  barraAtiva: {
    position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
    background: 'var(--accent)', borderRadius: '0 3px 3px 0',
  },
  rodape: {
    padding: '12px 10px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  btnSair: {
    width: '100%',
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '10px 12px', borderRadius: 8,
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'inherit',
    transition: 'background 150ms ease',
  },
};
