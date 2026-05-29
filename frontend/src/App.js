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
  // Estado global de processamento — visível em qualquer aba
  const [processando, setProcessando] = useState(null); // null | 'despesas' | 'receitas'

  return (
    <div style={{ minHeight: '100vh', background: '#F4F4F8', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div className="resp-header" style={{ background: '#1A1A2E', color: '#fff', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>💼 Conciliador Financeiro</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>BPO Financeiro — Conciliação automática de cartões</div>
        </div>
        <div style={{ fontSize: 11, color: '#666', background: '#fff', borderRadius: 6, padding: '4px 10px' }}>v2.1</div>
      </div>

      {/* Banner global — aparece em QUALQUER aba enquanto processa */}
      {processando && (
        <div className="resp-banner" style={{
          background: '#1A5FA8', color: '#fff',
          padding: '9px 32px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
            animation: 'spin 0.8s linear infinite', flexShrink: 0,
          }} />
          <span>
            <strong>Conciliação de {processando === 'despesas' ? 'Despesas' : 'Receitas'} em andamento…</strong>
            {' '}Você pode navegar entre as abas — o processo continua em segundo plano.
          </span>
          <button
            onClick={() => setAba(processando)}
            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Ver progresso →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="resp-tabs" style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 32px', display: 'flex', gap: 0 }}>
        {ABAS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setAba(key)}
            style={{
              padding: '13px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: aba === key ? 700 : 400, fontSize: 14,
              color: aba === key ? '#1A1A2E' : '#888',
              borderBottom: aba === key ? '2.5px solid #1A1A2E' : '2.5px solid transparent',
              display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s',
              position: 'relative',
            }}>
            <Icon size={15} /> {label}
            {/* Ponto indicador de atividade */}
            {processando === key && (
              <span style={{
                width: 7, height: 7, background: '#3B9EFF', borderRadius: '50%',
                position: 'absolute', top: 8, right: 6,
                animation: 'pulse 1.2s ease-in-out infinite',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo — display:none preserva estado + sessionStorage como fallback */}
      <div className="resp-content" style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px' }}>
        <div className="resp-card" style={{ background: '#fff', borderRadius: 12, padding: '28px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: aba === 'despesas' ? 'block' : 'none' }}>
            <DespesasPage setProcessando={setProcessando} />
          </div>
          <div style={{ display: aba === 'receitas' ? 'block' : 'none' }}>
            <ReceitasPage setProcessando={setProcessando} />
          </div>
          {aba === 'dashboard' && <DashboardPage />}
        </div>
      </div>
    </div>
  );
}
