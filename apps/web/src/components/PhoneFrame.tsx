import React from 'react';

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        className="relative bg-black rounded-[48px] p-3 shadow-2xl"
        style={{ width: 390, height: 844 }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-2xl z-50" />

        <div className="w-full h-full rounded-[36px] overflow-hidden relative"
          style={{ background: 'var(--bg-base)' }}>
          <div className="h-[44px] flex items-end justify-center px-6 pb-1 z-40 relative"
            style={{ background: 'inherit' }}>
            <div className="flex items-center justify-between w-full text-[11px] font-semibold text-[#1f1b16]">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><rect x="0" y="4" width="3" height="7" rx="1" opacity="0.3"/><rect x="4.5" y="2.5" width="3" height="8.5" rx="1" opacity="0.5"/><rect x="9" y="1" width="3" height="10" rx="1" opacity="0.7"/><rect x="13" y="0" width="3" height="11" rx="1"/></svg>
                <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 3.5C9.1 3.5 10.5 4.1 11.6 5.1L13 3.7C11.5 2.3 9.6 1.5 7.5 1.5S3.5 2.3 2 3.7L3.4 5.1C4.5 4.1 5.9 3.5 7.5 3.5Z" opacity="0.5"/><path d="M7.5 6.5C8.5 6.5 9.3 6.9 9.9 7.5L11.3 6.1C10.3 5.2 9 4.5 7.5 4.5S4.7 5.2 3.7 6.1L5.1 7.5C5.7 6.9 6.5 6.5 7.5 6.5Z" opacity="0.75"/><circle cx="7.5" cy="9.5" r="1.5"/></svg>
                <svg width="25" height="11" viewBox="0 0 25 11" fill="currentColor"><rect x="0" y="1" width="21" height="9" rx="2" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.35"/><rect x="22" y="3.5" width="2" height="4" rx="0.5" opacity="0.35"/><rect x="1.5" y="2.5" width="14" height="6" rx="1" fill="#34C759"/></svg>
              </div>
            </div>
          </div>

          <div className="h-[calc(100%-44px)] overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
