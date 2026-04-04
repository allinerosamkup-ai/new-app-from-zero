import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
import React from 'react';
import '../styles/aura-v2.css';

const PhoneFrame: React.FC<{ children: React.ReactNode, label?: string }> = ({ children, label }) => {
  return (
    <div className="phone-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {label && <div className="screen-label" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A8A87' }}>{label}</div>}
      <div className="phone" style={{ width: '320px', background: '#111', borderRadius: '44px', padding: '12px', boxShadow: '0 30px 80px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset' }}>
        <div className="phone-inner" style={{ width: '100%', borderRadius: '32px', overflow: 'hidden', background: 'var(--warm-bg)', position: 'relative', minHeight: '620px' }}>
          <div style={{ height: '28px', background: '#111', borderRadius: '0 0 16px 16px', width: '90px', margin: '0 auto', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}></div>
          <div className="phone-status" style={{ height: '44px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 20px 6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)' }}>
            <span>9:41</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><rect x="0" y="3" width="3" height="8" rx="1" fill="#3A2E2B" opacity=".35"/><rect x="4.5" y="2" width="3" height="9" rx="1" fill="#3A2E2B" opacity=".55"/><rect x="9" y="0" width="3" height="11" rx="1" fill="#3A2E2B" opacity=".75"/><rect x="13.5" y="0" width="2.5" height="11" rx="1" fill="#3A2E2B"/></svg>
              <svg width="25" height="11" viewBox="0 0 25 11" fill="none"><rect x="0.5" y="0.5" width="21" height="10" rx="3.5" stroke="#3A2E2B" strokeOpacity=".35"/><rect x="2" y="2" width="17" height="7" rx="2" fill="#3A2E2B"/><path d="M23 3.5V7.5C23.8 7.2 24.5 6.4 24.5 5.5C24.5 4.6 23.8 3.8 23 3.5Z" fill="#3A2E2B" opacity=".4"/></svg>
            </div>
          </div>
          <div style={{ padding: '8px 16px 20px' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AuraV2Showcase: React.FC = () => {
  return (
    <div className="aura-v2-container" style={{ padding: '40px 20px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '60px', minHeight: '100vh' }}>
      
      <div style={{ textAlign: 'center' }}>
        <h1 className="page-title" style={{ fontFamily: 'Poppins', fontSize: '13px', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9A8A87' }}>
          ② Home Screen — Com Check-in
        </h1>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', justifyContent: 'center' }}>
        
        {/* HOME SCREEN */}
        <PhoneFrame label="Com check-in">
          <div className="home-header">
            <p style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,.7)', marginBottom: '2px' }}>Bom dia,</p>
            <h1>Maria ✨</h1>
          </div>

          {/* Status Card */}
          <div style={{ 
            background: 'linear-gradient(135deg, var(--nectarine-a3), rgba(197,165,147, .04))',
            border: '1px solid rgba(255,255,255,.7)',
            borderRadius: '19.5px',
            padding: '15.6px',
            marginBottom: '13px',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>✨</span>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--nectarine-11)' }}>Energia Radiante</span>
              </div>
              <div style={{ background: 'var(--nectarine-a3)', color: 'var(--nectarine-11)', padding: '4px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700 }}>MODERADO</div>
            </div>
            <p style={{ fontSize: '12.5px', lineHeight: 1.6, color: 'var(--nectarine-11)', opacity: .85, textAlign: 'center', marginBottom: '10px' }}>
              Humor e energia em equilíbrio. Clareza mental acima da média.
            </p>
            <div style={{ height: '1px', background: 'var(--warm-border-2)', margin: '10px 0' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--nectarine-10)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span style={{ fontSize: '11.5px', fontStyle: 'italic', color: 'var(--nectarine-11)' }}>Aproveite o pico para suas tarefas mais importantes antes das 14h.</span>
            </div>
          </div>

          {/* Mini Chart Area */}
          <div className="mini-chart-area">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--menthe)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Humor da Semana</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--text-3)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--menthe)' }}></span>Humor
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--text-3)' }}>
                  <span style={{ width: '10px', height: '2px', background: 'var(--menthe)', opacity: .6, display: 'inline-block', borderTop: '2px dashed var(--menthe)' }}></span>Energia
                </div>
              </div>
            </div>
            
            <svg width="100%" viewBox="0 0 280 72" style={{ overflow: 'visible' }}>
              <line x1="16" y1="12" x2="264" y2="12" stroke="rgba(0,0,0,.04)" strokeWidth="1" strokeDasharray="3,3"/>
              <line x1="16" y1="29" x2="264" y2="29" stroke="rgba(0,0,0,.04)" strokeWidth="1" strokeDasharray="3,3"/>
              <line x1="16" y1="46" x2="264" y2="46" stroke="rgba(0,0,0,.04)" strokeWidth="1" strokeDasharray="3,3"/>
              <line x1="16" y1="63" x2="264" y2="63" stroke="rgba(0,0,0,.04)" strokeWidth="1" strokeDasharray="3,3"/>
              <path d="M16 52 C50 52 60 20 80 24 C100 28 110 38 140 32 C170 26 190 18 220 20 C240 21 256 28 264 24" fill="none" stroke="var(--menthe)" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M16 52 C50 52 60 20 80 24 C100 28 110 38 140 32 C170 26 190 18 220 20 C240 21 256 28 264 24 L264 72 L16 72 Z" fill="url(#moodg_home)" opacity=".5"/>
              <path d="M16 56 C50 56 60 30 80 34 C100 38 110 44 140 40 C170 36 190 26 220 30 C240 32 256 36 264 32" fill="none" stroke="var(--menthe)" strokeWidth="1.5" strokeDasharray="4,3" opacity=".6"/>
              <circle cx="264" cy="24" r="4" fill="var(--nectarine)" stroke="white" strokeWidth="1.5"/>
              <circle cx="220" cy="20" r="3.5" fill="var(--menthe)" stroke="white" strokeWidth="1.5"/>
              <circle cx="140" cy="32" r="3.5" fill="#C5A593" stroke="white" strokeWidth="1.5"/>
              <circle cx="80" cy="24" r="3.5" fill="var(--menthe)" stroke="white" strokeWidth="1.5"/>
              <text x="16" y="74" textAnchor="middle" fontSize="9" fill="var(--text-3)">Qui</text>
              <text x="56" y="74" textAnchor="middle" fontSize="9" fill="var(--text-3)">Sex</text>
              <text x="96" y="74" textAnchor="middle" fontSize="9" fill="var(--text-3)">Sáb</text>
              <text x="140" y="74" textAnchor="middle" fontSize="9" fill="var(--text-3)">Dom</text>
              <text x="180" y="74" textAnchor="middle" fontSize="9" fill="var(--text-3)">Seg</text>
              <text x="220" y="74" textAnchor="middle" fontSize="9" fill="var(--text-3)">Ter</text>
              <text x="264" y="74" textAnchor="middle" fontSize="9" fill="var(--text-1)" fontWeight="700">Hoj</text>
              <defs>
                <linearGradient id="moodg_home" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--menthe)" stopOpacity=".25"/>
                  <stop offset="100%" stopColor="var(--menthe)" stopOpacity="0"/>
                </linearGradient>
              </defs>
            </svg>
            
            <AuraButtonV2 className="chart-checkin-btn">
              <span style={{ fontSize: '16px' }}>😊</span>
              Fazer check-in de hoje
            </AuraButtonV2>
          </div>

          {/* Shortcuts */}
          <div className="shortcut-grid">
            <div className="shortcut-card">
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--nectarine-a3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--nectarine)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)' }}>Diário</span>
              <span style={{ fontSize: '9.5px', color: 'var(--text-3)' }}>Falar com IA</span>
            </div>
            <div className="shortcut-card">
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(176,180,196,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lagune)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)' }}>Planner</span>
              <span style={{ fontSize: '9.5px', color: 'var(--text-3)' }}>Organizar dia</span>
            </div>
            <div className="shortcut-card">
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(180,185,169,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--menthe)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)' }}>Padrões</span>
              <span style={{ fontSize: '9.5px', color: 'var(--text-3)' }}>Ciclagem</span>
            </div>
          </div>

          {/* Agenda */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: '15px', fontWeight: 700, color: 'var(--text-1)' }}>Próximo na agenda</span>
            <AuraButtonV2 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--nectarine)', display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver tudo <span style={{ fontSize: '14px' }}>→</span>
            </AuraButtonV2>
          </div>
          
          <div style={{ 
            background: 'rgba(255,253,249, .85)',
            border: '1px solid rgba(255,255,255, .7)',
            borderRadius: '19.5px',
            padding: '12px 14px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 2px 8px rgba(197,165,147, .07)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>14:00 — 15:00</span>
              <span style={{ color: 'var(--nectarine)', fontSize: '14px' }}>→</span>
            </div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', textAlign: 'center' }}>Reunião de planejamento</p>
            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '22px', padding: '0 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', background: 'rgba(176,180,196,.12)', color: '#4A7A8E', border: '1px solid rgba(176,180,196,.2)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--lagune)' }}></span>
                TRABALHO
              </div>
            </div>
          </div>
        </PhoneFrame>

      </div>
    </div>
  );
};
