import React, { useState } from 'react';
import { User, LogOut, Shield, ChevronRight, Clock, Sun, Moon, Heart } from 'lucide-react';

export default function ConfigScreen() {
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 pt-3 pb-4" style={{ background: 'var(--bg-base)' }}>
      <div className="mb-5 animate-fade-in">
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>Ajustes</p>
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Configurações
        </h1>
      </div>

      <div className="glass-card rounded-[22px] p-4 mb-3.5 animate-fade-in delay-100">
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(31,59,50,0.08)' }}>
            <User size={22} style={{ color: 'var(--accent-green)' }} />
          </div>
          <div className="flex-1 ml-3">
            <p className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>Ana Silva</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>ana.silva@email.com</p>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[22px] p-4 mb-3.5 animate-fade-in delay-200">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={14} style={{ color: 'var(--accent-green)' }} />
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Rotina</p>
        </div>

        <div className="mb-4">
          <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Fuso horário</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full glass-card rounded-xl px-4 py-3 text-[13px] outline-none"
            style={{ color: 'var(--text-primary)' }}
          >
            <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
            <option value="America/Manaus">Manaus (GMT-4)</option>
            <option value="America/Bahia">Bahia (GMT-3)</option>
            <option value="America/Recife">Recife (GMT-3)</option>
            <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sun size={13} style={{ color: 'var(--accent-orange)' }} />
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>Acordar</label>
            </div>
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="w-full glass-card rounded-xl px-4 py-3 text-[13px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Moon size={13} style={{ color: 'var(--accent-purple)' }} />
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>Dormir</label>
            </div>
            <input
              type="time"
              value={sleepTime}
              onChange={(e) => setSleepTime(e.target.value)}
              className="w-full glass-card rounded-xl px-4 py-3 text-[13px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[22px] overflow-hidden mb-3.5 animate-fade-in delay-300">
        <button className="w-full flex items-center px-4 py-4 hover:bg-black/3 transition-colors">
          <Heart size={18} style={{ color: 'var(--accent-purple)' }} />
          <span className="flex-1 ml-3 text-[14px] text-left" style={{ color: 'var(--text-primary)' }}>Sobre ciclagem de humor</span>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div style={{ height: 1, background: 'rgba(31,59,50,0.06)' }} />
        <button className="w-full flex items-center px-4 py-4 hover:bg-black/3 transition-colors">
          <Shield size={18} style={{ color: 'var(--accent-green)' }} />
          <span className="flex-1 ml-3 text-[14px] text-left" style={{ color: 'var(--text-primary)' }}>Privacidade e dados</span>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      <button className="glass-card rounded-[22px] px-4 py-4 flex items-center transition-all hover:shadow-md animate-fade-in delay-400">
        <LogOut size={18} style={{ color: 'var(--accent-rose)' }} />
        <span className="ml-3 text-[14px] font-semibold" style={{ color: 'var(--accent-rose)' }}>Sair da conta</span>
      </button>

      <p className="text-center text-[11px] mt-6" style={{ color: 'var(--text-muted)' }}>
        Mood Energy — MVP v1.0
      </p>
    </div>
  );
}
