import { useState } from 'react';
import { LayoutDashboard, TrendingUp, TrendingDown } from 'lucide-react';
import DespesasPage from './pages/DespesasPage';
import ReceitasPage from './pages/ReceitasPage';
import DashboardPage from './pages/DashboardPage';

const ABAS = [
  { key: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { key: 'despesas',  label: 'Despesas',   icon: TrendingDown },
  { key: 'receitas',  label: 'Receitas',   icon: TrendingUp },
];

export default function App() {
  const [aba, setAba] = useState('dashboard');

  return (
    <div style={{ minHeight: '100vh', background: '#F4F4F8', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1A1A2E', color: '#fff', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>💼 Conciliador Financeiro</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>BPO Financeiro — Conciliação automática de cartões</div>
        </div>
        <div style={{ fontSize: 11, color: '#666', background: '#fff', borderRadius: 6, padding: '4px 10px' }}>v2.0</div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 32px', display: 'flex', gap: 0 }}>
        {ABAS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setAba(key)}
            style={{
              padding: '13px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: aba === key ? 700 : 400, fontSize: 14,
              color: aba === key ? '#1A1A2E' : '#888',
              borderBottom: aba === key ? '2.5px solid #1A1A2E' : '2.5px solid transparent',
              display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s',
            }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Conteúdo — display:none preserva estado ao trocar de aba */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '28px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* DespesasPage e ReceitasPage ficam sempre montadas — arquivos e resultado não somem */}
          <div style={{ display: aba === 'despesas' ? 'block' : 'none' }}><DespesasPage /></div>
          <div style={{ display: aba === 'receitas' ? 'block' : 'none' }}><ReceitasPage /></div>
          {/* Dashboard re-monta ao navegar para atualizar o histórico */}
          {aba === 'dashboard' && <DashboardPage />}
        </div>
      </div>
    </div>
  );
}
