import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function AppLayout() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <Topbar />
      <main style={s.conteudo}>
        <Outlet />
      </main>
    </div>
  );
}

const s = {
  conteudo: {
    marginLeft: 240,
    marginTop: 56,
    padding: 24,
    minHeight: 'calc(100vh - 56px)',
  },
};
