import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Sparkles, GripVertical, Check, ChevronDown, ChevronUp, Clock, Zap, Bell, Scissors, Timer, X } from 'lucide-react';
import { useNavigation } from '../navigation';

type SubTask = { id: string; title: string; done: boolean };

type Block = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: 'trabalho' | 'saúde' | 'lazer' | 'rotina';
  intensity: 'L' | 'M' | 'P';
  isAiSuggested: boolean;
  subtasks: SubTask[];
  alert?: string;
};

const MOCK_BLOCKS: Block[] = [
  { id: '1', title: 'Meditação matinal', startTime: '07:00', endTime: '07:30', category: 'saúde', intensity: 'L', isAiSuggested: true, subtasks: [
    { id: 's1', title: 'Respiração guiada (5 min)', done: true },
    { id: 's2', title: 'Meditação silenciosa (10 min)', done: false },
  ]},
  { id: '2', title: 'Foco no projeto', startTime: '09:00', endTime: '11:00', category: 'trabalho', intensity: 'P', isAiSuggested: false, subtasks: [
    { id: 's3', title: 'Revisar backlog', done: true },
    { id: 's4', title: 'Escrever relatório', done: false },
    { id: 's5', title: 'Enviar para revisão', done: false },
  ], alert: '5 min antes' },
  { id: '3', title: 'Almoço & descanso', startTime: '12:00', endTime: '13:00', category: 'lazer', intensity: 'L', isAiSuggested: false, subtasks: [] },
  { id: '4', title: 'Reunião de alinhamento', startTime: '14:00', endTime: '15:00', category: 'trabalho', intensity: 'M', isAiSuggested: false, subtasks: [], alert: '10 min antes' },
  { id: '5', title: 'Caminhada', startTime: '17:00', endTime: '17:45', category: 'saúde', intensity: 'L', isAiSuggested: true, subtasks: [] },
  { id: '6', title: 'Leitura', startTime: '21:00', endTime: '22:00', category: 'lazer', intensity: 'L', isAiSuggested: false, subtasks: [] },
];

const catConfig: Record<string, { color: string; bg: string; label: string }> = {
  trabalho: { color: '#6398A9', bg: 'rgba(99,152,169,0.09)',  label: 'Trabalho' },
  saúde:    { color: '#96C7B3', bg: 'rgba(150,199,179,0.09)', label: 'Saúde' },
  lazer:    { color: '#F9B95C', bg: 'rgba(249,185,92,0.09)',  label: 'Lazer' },
  rotina:   { color: '#D7897F', bg: 'rgba(215,137,127,0.09)', label: 'Rotina' },
};

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="absolute top-2 left-4 right-4 z-[60] animate-slide-down">
      <div className="glass-strong rounded-2xl px-4 py-3 flex items-center gap-2"
        style={{ boxShadow: 'var(--shadow-lg)', background: 'var(--bg-dark)' }}>
        <Bell size={16} color="white" />
        <p className="text-white text-[13px] font-medium flex-1">{message}</p>
        <button onClick={onClose} className="p-1">
          <X size={14} color="white" />
        </button>
      </div>
    </div>
  );
}

function useTimeProgress(startTime: string, endTime: string) {
  const calc = () => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;
    if (nowMin < startMin) return 0;
    if (nowMin >= endMin)  return 1;
    return (nowMin - startMin) / (endMin - startMin);
  };
  const [progress, setProgress] = React.useState(calc);
  useEffect(() => {
    setProgress(calc());
    const id = setInterval(() => setProgress(calc()), 60_000);
    return () => clearInterval(id);
  }, [startTime, endTime]);
  return progress;
}

function TimelineBlock({ block, onToggleSub, onToggleExpand, expanded, onSplit, onPomodoro }: {
  block: Block;
  onToggleSub: (blockId: string, subId: string) => void;
  onToggleExpand: (blockId: string) => void;
  expanded: boolean;
  onSplit: (blockId: string) => void;
  onPomodoro: (blockId: string) => void;
}) {
  const cat      = catConfig[block.category] || catConfig.rotina;
  const doneSubs = block.subtasks.filter(s => s.done).length;
  const totalSubs = block.subtasks.length;
  const progress = useTimeProgress(block.startTime, block.endTime);

  return (
    <div
      className="glass-card rounded-[18px] p-3.5 mb-2.5 transition-all duration-200 hover:shadow-md cursor-grab active:cursor-grabbing"
      style={{ borderLeft: '6px solid transparent', position: 'relative', overflow: 'hidden' }}
    >
      {/* Barra lateral com progresso de tempo */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 6,
        background: `rgba(${cat.color === '#6398A9' ? '99,152,169' : cat.color === '#96C7B3' ? '150,199,179' : cat.color === '#F9B95C' ? '249,185,92' : '215,137,127'}, 0.18)`,
        borderRadius: '18px 0 0 18px',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0,
          height: `${progress * 100}%`,
          background: cat.color,
          borderRadius: progress < 0.05 ? '18px 0 0 18px' : progress > 0.95 ? '18px 0 0 18px' : '18px 0 0 0',
          transition: 'height 1s ease',
        }} />
      </div>
      <div className="flex items-start gap-2">
        <div className="mt-1 opacity-30 hover:opacity-60 transition-opacity">
          <GripVertical size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              {block.startTime} — {block.endTime}
            </span>
            {block.isAiSuggested && <Sparkles size={10} style={{ color: 'var(--accent-purple)' }} />}
            {block.alert && (
              <span className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent-orange)' }}>
                <Bell size={8} /> {block.alert}
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {block.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: cat.bg, color: cat.color }}>
              {cat.label}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {block.intensity === 'P' ? '🔴 Pesada' : block.intensity === 'M' ? '🟡 Média' : '🟢 Leve'}
            </span>
            {totalSubs > 0 && (
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                {doneSubs}/{totalSubs}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <button onClick={() => onSplit(block.id)}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all hover:bg-black/5"
              style={{ color: 'var(--accent-purple)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <Scissors size={10} /> Dividir
            </button>
            <button onClick={() => onPomodoro(block.id)}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all hover:bg-black/5"
              style={{ color: 'var(--accent-green)', border: '1px solid rgba(31,59,50,0.12)' }}>
              <Timer size={10} /> Pomodoro
            </button>
          </div>
        </div>
      </div>

      {totalSubs > 0 && (
        <>
          <button
            onClick={() => onToggleExpand(block.id)}
            className="flex items-center gap-1 mt-2.5 ml-6 text-[11px] font-semibold transition-colors"
            style={{ color: 'var(--accent-green)' }}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Ocultar subtarefas' : `Ver ${totalSubs} subtarefas`}
          </button>

          {expanded && (
            <div className="ml-6 mt-2 space-y-1.5">
              {block.subtasks.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => onToggleSub(block.id, sub.id)}
                  className="flex items-center gap-2 w-full text-left p-2 rounded-xl transition-all hover:bg-black/3"
                >
                  <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: sub.done ? 'var(--accent-green)' : 'transparent',
                      border: sub.done ? 'none' : '2px solid var(--text-muted)',
                    }}>
                    {sub.done && <Check size={12} color="white" strokeWidth={3} />}
                  </div>
                  <span className="text-[12px]" style={{
                    color: sub.done ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: sub.done ? 'line-through' : 'none',
                  }}>
                    {sub.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {totalSubs > 0 && (
        <div className="ml-6 mt-2">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(31,59,50,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(doneSubs / totalSubs) * 100}%`, background: 'var(--accent-green)' }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlannerScreen() {
  const { navigate } = useNavigation();
  const [dateOffset, setDateOffset] = useState(0);
  const [blocks, setBlocks] = useState(MOCK_BLOCKS);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showNewTask, setShowNewTask] = useState(false);
  const [showSplit, setShowSplit] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('10:00');
  const [newDuration, setNewDuration] = useState('60');
  const [newCategory, setNewCategory] = useState('trabalho');
  const [newIntensity, setNewIntensity] = useState<'L' | 'M' | 'P'>('M');
  const [newNote, setNewNote] = useState('');

  const date = new Date();
  date.setDate(date.getDate() + dateOffset);
  const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  const toggleSub = (blockId: string, subId: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, subtasks: b.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s) } : b
    ));
  };

  const toggleExpand = (blockId: string) => {
    setExpanded(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const handleSplit = (blockId: string) => {
    setShowSplit(blockId);
  };

  const confirmSplit = () => {
    if (!showSplit) return;
    setIsSplitting(true);
    const block = blocks.find(b => b.id === showSplit);
    if (!block) return;

    setTimeout(() => {
      const [sh, sm] = block.startTime.split(':').map(Number);
      const [eh, em] = block.endTime.split(':').map(Number);
      const totalMin = (eh * 60 + em) - (sh * 60 + sm);
      const halfMin = Math.floor(totalMin / 2);

      const midH = Math.floor((sh * 60 + sm + halfMin) / 60);
      const midM = (sh * 60 + sm + halfMin) % 60;
      const midTime = `${midH.toString().padStart(2, '0')}:${midM.toString().padStart(2, '0')}`;

      const part1: Block = {
        ...block,
        id: `${block.id}-a`,
        title: `${block.title} (parte 1)`,
        endTime: midTime,
        intensity: 'M',
        subtasks: block.subtasks.length > 0
          ? block.subtasks.slice(0, Math.ceil(block.subtasks.length / 2))
          : [{ id: `split-${Date.now()}-1`, title: 'Primeira metade da tarefa', done: false }],
      };

      const part2: Block = {
        ...block,
        id: `${block.id}-b`,
        title: `${block.title} (parte 2)`,
        startTime: midTime,
        intensity: 'L',
        isAiSuggested: true,
        subtasks: block.subtasks.length > 0
          ? block.subtasks.slice(Math.ceil(block.subtasks.length / 2))
          : [{ id: `split-${Date.now()}-2`, title: 'Segunda metade da tarefa', done: false }],
      };

      setBlocks(prev => {
        const filtered = prev.filter(b => b.id !== showSplit);
        return [...filtered, part1, part2].sort((a, b) => a.startTime.localeCompare(b.startTime));
      });
      setShowSplit(null);
      setIsSplitting(false);
      setToast(`"${block.title}" foi dividida em 2 blocos pela IA`);
    }, 1200);
  };

  const handlePomodoro = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (block) {
      navigate('pomodoro', { taskName: block.title });
    }
  };

  const addTask = () => {
    if (!newTitle.trim()) return;
    const dur = parseInt(newDuration) || 60;
    const [h, m] = newStart.split(':').map(Number);
    const endH = Math.floor((h * 60 + m + dur) / 60);
    const endM = (h * 60 + m + dur) % 60;
    const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
    const newBlock: Block = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      startTime: newStart,
      endTime,
      category: newCategory as Block['category'],
      intensity: newIntensity,
      isAiSuggested: false,
      subtasks: [],
    };
    setBlocks(prev => [...prev, newBlock].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    setNewTitle('');
    setNewNote('');
    setShowNewTask(false);
    setToast(`"${newBlock.title}" adicionada ao planner`);
  };

  const splitBlock = showSplit ? blocks.find(b => b.id === showSplit) : null;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <button onClick={() => setDateOffset(d => d - 1)} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
          <ChevronLeft size={22} style={{ color: 'var(--text-primary)' }} />
        </button>
        <div className="text-center">
          <p className="text-[16px] font-bold capitalize" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {dateStr}
          </p>
          <p className="text-[10px] uppercase tracking-[2px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Timeline do Dia
          </p>
        </div>
        <button onClick={() => setDateOffset(d => d + 1)} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
          <ChevronRight size={22} style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 relative">
        <div className="relative" style={{ minHeight: hours.length * 56 + 40 }}>
          {hours.map((hour) => {
            const top = (hour - 6) * 56;
            return (
              <div key={hour} className="absolute left-0 right-0 flex items-center" style={{ top }}>
                <div className="w-12 text-right pr-2">
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
                <div className="flex-1 h-px" style={{ background: 'rgba(31,59,50,0.06)' }} />
              </div>
            );
          })}

          {dateOffset === 0 && currentMinutes >= 360 && currentMinutes <= 1380 && (
            <div className="absolute left-12 right-0 flex items-center z-20" style={{ top: (currentMinutes - 360) * (56 / 60) }}>
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-rose)' }} />
              <div className="flex-1 h-[2px]" style={{ background: 'var(--accent-rose)', opacity: 0.5 }} />
            </div>
          )}

          <div className="absolute left-[52px] right-0 pt-1">
            {blocks.map((block, i) => {
              const [sh, sm] = block.startTime.split(':').map(Number);
              const top = (sh * 60 + sm - 360) * (56 / 60);
              return (
                <div key={block.id} style={{ marginTop: i === 0 ? top : 8 }}>
                  <TimelineBlock
                    block={block}
                    onToggleSub={toggleSub}
                    onToggleExpand={toggleExpand}
                    expanded={!!expanded[block.id]}
                    onSplit={handleSplit}
                    onPomodoro={handlePomodoro}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showSplit && splitBlock && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSplit(null); }}>
          <div className="w-full rounded-t-[28px] p-5 animate-slide-up" style={{ background: 'var(--bg-base)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(31,59,50,0.15)' }} />
            <div className="flex items-center gap-2 mb-2">
              <Scissors size={18} style={{ color: 'var(--accent-purple)' }} />
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                Dividir Tarefa
              </h3>
            </div>
            <p className="text-[13px] mb-4" style={{ color: 'var(--text-muted)' }}>
              A IA vai dividir "{splitBlock.title}" em blocos menores adaptados à sua energia.
            </p>

            <div className="glass-card rounded-[18px] p-4 mb-3"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(45,212,191,0.04))' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={12} style={{ color: 'var(--accent-purple)' }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-purple)' }}>
                  Preview da divisão
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-orange)' }} />
                  <span className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
                    {splitBlock.title} (parte 1) — energia média
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--cat-saude)' }} />
                  <span className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
                    {splitBlock.title} (parte 2) — energia leve
                  </span>
                </div>
              </div>
            </div>

            <button onClick={confirmSplit}
              disabled={isSplitting}
              className="w-full py-[16px] rounded-[20px] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-lg)' }}>
              {isSplitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Dividindo...
                </>
              ) : (
                <>
                  <Scissors size={18} /> Confirmar divisão
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showNewTask && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewTask(false); }}>
          <div className="w-full glass-strong rounded-t-[28px] p-5 animate-slide-up" style={{ background: 'var(--bg-base)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(31,59,50,0.15)' }} />
            <h3 className="text-[16px] font-bold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Nova Tarefa
            </h3>

            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="O que você precisa fazer?"
              className="w-full glass-card rounded-2xl px-4 py-3.5 text-[14px] outline-none mb-3"
              style={{ color: 'var(--text-primary)' }}
              autoFocus
            />

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                  <Clock size={10} className="inline mr-1" /> Horário
                </label>
                <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)}
                  className="w-full glass-card rounded-xl px-3 py-2.5 text-[13px] outline-none" style={{ color: 'var(--text-primary)' }} />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                  Duração (min)
                </label>
                <select value={newDuration} onChange={e => setNewDuration(e.target.value)}
                  className="w-full glass-card rounded-xl px-3 py-2.5 text-[13px] outline-none" style={{ color: 'var(--text-primary)' }}>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hora</option>
                  <option value="90">1h30</option>
                  <option value="120">2 horas</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Categoria
              </label>
              <div className="flex gap-2">
                {Object.entries(catConfig).map(([key, conf]) => (
                  <button key={key} onClick={() => setNewCategory(key)}
                    className="flex-1 py-2 rounded-xl text-[11px] font-semibold text-center transition-all"
                    style={{
                      background: newCategory === key ? conf.bg : 'transparent',
                      color: newCategory === key ? conf.color : 'var(--text-muted)',
                      border: newCategory === key ? `2px solid ${conf.color}` : '2px solid rgba(31,59,50,0.08)',
                    }}>
                    {conf.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <Zap size={10} /> Energia necessária
              </label>
              <div className="flex gap-2">
                {([['L', '🟢 Leve'], ['M', '🟡 Média'], ['P', '🔴 Pesada']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setNewIntensity(val)}
                    className="flex-1 py-2 rounded-xl text-[11px] font-medium text-center transition-all"
                    style={{
                      background: newIntensity === val ? 'var(--bg-dark)' : 'transparent',
                      color: newIntensity === val ? 'white' : 'var(--text-secondary)',
                      border: newIntensity === val ? 'none' : '2px solid rgba(31,59,50,0.08)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Notas (opcional)
              </label>
              <textarea
                placeholder="Adicione uma observação sobre a tarefa..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                rows={2}
                className="w-full glass-card rounded-2xl px-4 py-3 text-[13px] outline-none resize-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>

            <button onClick={addTask}
              className="w-full py-[16px] rounded-[20px] text-white font-bold text-[15px] transition-all active:scale-[0.98]"
              style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-lg)', opacity: newTitle.trim() ? 1 : 0.5 }}>
              Adicionar tarefa
            </button>
          </div>
        </div>
      )}

      <div className="absolute bottom-[88px] right-5 z-30">
        <button
          onClick={() => setShowNewTask(true)}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-[0.9]"
          style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-lg)' }}>
          <Plus size={26} color="white" />
        </button>
      </div>
    </div>
  );
}
