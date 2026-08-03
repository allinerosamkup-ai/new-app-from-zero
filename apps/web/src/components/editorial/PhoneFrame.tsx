import React from 'react';

export const PhoneFrame: React.FC<{ children: React.ReactNode, label?: string }> = ({ children, label }) => {
  return (
    <div className="phone-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {label && <div className="screen-label" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A8A87' }}>{label}</div>}
      <div className="phone" style={{ width: '320px', background: '#111', borderRadius: '44px', padding: '12px', boxShadow: '0 30px 80px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset' }}>
        <div className="phone-inner" style={{ width: '100%', borderRadius: '32px', overflow: 'hidden', background: 'var(--warm-bg-v2)', position: 'relative', minHeight: '620px' }}>
          {/* notch */}
          <div style={{ height: '28px', background: '#111', borderRadius: '0 0 16px 16px', width: '90px', margin: '0 auto', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}></div>
          <div className="phone-status" style={{ height: '44px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 20px 6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-2-v2)' }}>
            <span>9:41</span>
            <div className="status-icons" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <svg width="25" height="11" viewBox="0 0 25 11" fill="none"><rect x="0.5" y="0.5" width="21" height="10" rx="3.5" stroke="#2B3630" strokeOpacity=".35"/><rect x="2" y="2" width="17" height="7" rx="2" fill="#2B3630"/></svg>
            </div>
          </div>
          <div className="screen-content" style={{ padding: '8px 16px 20px' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
