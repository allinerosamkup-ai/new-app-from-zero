import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, SkipForward, Coffee, Brain } from 'lucide-react';
import { useNavigation } from '../navigation';

type Phase = 'focus' | 'break' | 'longBreak';

const PHASE_CONFIG: Record<Phase, { label: string; duration: number; color: string; emoji: string; bg: string }> = {
  focus: { label: 'Foco', duration: 25 * 60, color: 'var(--accent-green)', emoji: '🎯', bg: 'rgba(31,59,50,0.06)' },
  break: { label: 'Pausa Curta', duration: 5 * 60, color: 'var(--accent-teal)', emoji: '☕', bg: 'rgba(45,212,191,0.06)' },
  longBreak: { label: 'Pausa Longa', duration: 15 * 60, color: 'var(--accent-purple)', emoji: '🌿', bg: 'rgba(139,92,246,0.06)' },
};

export default function PomodoroScreen() {
  const { navigate, params } = useNavigation();
  const [phase, setPhase] = useState<Phase>('focus');
  const [timeLeft, setTimeLeft] = useState(PHASE_CONFIG.focus.duration);
  const [isRunning, setIsRunning] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [totalFocusTime, setTotalFocusTime] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const taskName = (params.taskName as string) || 'Sessão de foco';

  const config = PHASE_CONFIG[phase];
  const progress = 1 - timeLeft / config.duration;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const switchPhase = useCallback((newPhase: Phase) => {
    setPhase(newPhase);
    setTimeLeft(PHASE_CONFIG[newPhase].duration);
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            if (phase === 'focus') {
              setCompletedCycles(c => c + 1);
              setTotalFocusTime(t => t + PHASE_CONFIG.focus.duration);
              const nextCycle = completedCycles + 1;
              if (nextCycle % 4 === 0) {
                switchPhase('longBreak');
              } else {
                switchPhase('break');
              }
            } else {
              switchPhase('focus');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, phase, completedCycles, switchPhase]);

  const reset = () => {
    setTimeLeft(config.duration);
    setIsRunning(false);
  };

  const circleRadius = 100;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center px-5 pt-2 pb-3">
        <button onClick={() => navigate('planner')} className="p-2 -ml-2 rounded-xl hover:bg-black/5">
          <ArrowLeft size={22} style={{ color: 'var(--text-primary)' }} />
        </button>
        <div className="ml-2 flex-1">
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Pomodoro
          </h1>
          <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{taskName}</p>
        </div>
      </div>

      <div className="flex justify-center gap-2 px-5 mb-6">
        {(['focus', 'break', 'longBreak'] as Phase[]).map((p) => (
          <button key={p} onClick={() => switchPhase(p)}
            className="flex-1 py-2 rounded-xl text-[11px] font-semibold text-center transition-all"
            style={{
              background: phase === p ? 'var(--bg-dark)' : 'transparent',
              color: phase === p ? 'white' : 'var(--text-muted)',
              border: phase === p ? 'none' : '1px solid rgba(31,59,50,0.08)',
            }}>
            {PHASE_CONFIG[p].label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <div className="relative animate-fade-in">
          <svg width="240" height="240" className="transform -rotate-90">
            <circle cx="120" cy="120" r={circleRadius} fill="none" stroke="rgba(31,59,50,0.06)" strokeWidth="8" />
            <circle cx="120" cy="120" r={circleRadius} fill="none" stroke={config.color} strokeWidth="8"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl mb-1">{config.emoji}</span>
            <span className="text-[42px] font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </span>
            <span className="text-[12px] font-medium mt-1" style={{ color: config.color }}>{config.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-8 animate-fade-in delay-100">
          <button onClick={reset}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-[0.9]"
            style={{ background: 'rgba(31,59,50,0.06)' }}>
            <RotateCcw size={20} style={{ color: 'var(--text-muted)' }} />
          </button>

          <button onClick={() => setIsRunning(!isRunning)}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-[0.9]"
            style={{ background: config.color, boxShadow: `0 6px 20px ${config.color}40` }}>
            {isRunning ? <Pause size={28} color="white" /> : <Play size={28} color="white" className="ml-1" />}
          </button>

          <button onClick={() => {
            if (phase === 'focus') {
              switchPhase(completedCycles > 0 && completedCycles % 3 === 0 ? 'longBreak' : 'break');
            } else {
              switchPhase('focus');
            }
          }}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-[0.9]"
            style={{ background: 'rgba(31,59,50,0.06)' }}>
            <SkipForward size={20} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="glass-card rounded-[20px] p-4 animate-fade-in delay-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                  {completedCycles}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Ciclos</p>
              </div>
              <div className="w-px h-8" style={{ background: 'rgba(31,59,50,0.08)' }} />
              <div className="text-center">
                <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                  {Math.round(totalFocusTime / 60)}m
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Foco total</p>
              </div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="w-3 h-3 rounded-full transition-all"
                  style={{ background: i < completedCycles % 4 ? config.color : 'rgba(31,59,50,0.08)' }} />
              ))}
            </div>
          </div>

          {completedCycles > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(31,59,50,0.06)' }}>
              <div className="flex items-center gap-1.5">
                <Brain size={11} style={{ color: 'var(--accent-purple)' }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-purple)' }}>Sugestão IA</p>
              </div>
              <p className="text-[12px] mt-1 italic" style={{ color: 'var(--text-secondary)' }}>
                {completedCycles >= 4
                  ? '"Você já fez 4 ciclos — ótimo trabalho! Considere encerrar para não exaustar sua energia."'
                  : '"Bom ritmo! Sua energia está no pico — aproveite para as tarefas mais exigentes."'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
