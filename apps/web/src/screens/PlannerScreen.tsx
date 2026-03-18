import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Sparkles, GripVertical, Check, ChevronDown, ChevronUp, Clock, Zap, Bell, Scissors, Timer, X } from 'lucide-react';
import { useNavigation } from '../navigation';
import { apiGet, apiFetch } from '../lib/api';

type Intensity = 'L' | 'M' | 'P';
type Category = 'trabalho' | 'pessoal' | 'autocuidado' | 'social' | 'outro';

type SubTask = { id: string; title: string; done: boolean };

type Block = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: Category;
  intensity: Intensity;
  isAiSuggested: boolean;
  status: string;
  subtasks: SubTask[];
};

const catConfig: Record<Category, { color: string; bg: string; label: string }> = {
  trabalho:     { color: '#6398A9', bg: 'rgba(99,152,169,0.09)',  label: 'Trabalho' },
  autocuidado:  { color: '#96C7B3', bg: 'rgba(150,199,179,0.09)', label: 'Autocuidado' },
  pessoal:      { color: '#F9B95C', bg: 'rgba(249,185,92,0.09)',  label: 'Pessoal' },
  social:       { color: '#D7897F', bg: 'rgba(215,137,127,0.09)', label: 'Social' },
  outro:        { color: '#A9A9C8', bg: 'rgba(169,169,200,0.09)', label: 'Outro' },
};

function dateKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="absolute top-2 left-4 right-4 z-[60] animate-slide-down">
      <div className="glass-strong rounded-2xl px-4 py-3 flex items-center gap-2"
        style={{ boxShadow: 'var(--shadow-lg)', background: 'var(--bg-dark)' }}>
        <Bell size={16} color="white" strokeWidth={1.5} />
        <p className="text-white text-[13px] font-medium flex-1">{message}</p>
        <button onClick={onClose} className="p-1"><X size={14} color="white" strokeWidth={1.5} /></button>
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

function TimelineBlock({ block, onToggleSub, onToggleExpand, expanded, onSplit, onPomodoro, onDelete }: {
  block: Block;
  onToggleSub: (blockId: string, subId: string) => void;
  onToggleExpand: (blockId: string) => void;
  expanded: boolean;
  onSplit: (blockId: string) => void;
  onPomodoro: (blockId: string) => void;
  onDelete: (blockId: string) => void;
}) {
  const cat = catConfig[block.category] ?? catConfig.outro;
  const doneSubs = block.subtasks.filter(s => s.done).length;
  const totalSubs = block.subtasks.length;
  const progress = useTimeProgress(block.startTime, block.endTime);

  // rgb extraído manualmente por categoria para o gradiente da barra lateral
  const catRgb: Record<Category, string> = {
    trabalho: '99,152,169', autocuidado: '150,199,179',
    pessoal: '249,185,92', social: '215,137,127', outro: '169,169,200',
  };

  return (
    <div className="glass-card interactive-card rounded-[18px] p-3.5 mb-2.5 transition-all duration-200 hover:shadow-md"
      style={{ borderLeft: `5px solid var(--cat-${block.category}, ${cat.color})`, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 6,
        background: `rgba(${catRgb[block.category] ?? catRgb.outro}, 0.18)`,
        borderRadius: '18px 0 0 18px',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0,
          height: `${progress * 100}%`,
          background: cat.color,
          borderRadius: '18px 0 0 0',
          transition: 'height 1s ease',
        }} />
      </div>

      <div className="flex items-start gap-2">
        <div className="mt-1 opacity-30"><GripVertical size={14} strokeWidth={1.5} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              {block.startTime} — {block.endTime}
            </span>
            {block.isAiSuggested && <Sparkles size={10} strokeWidth={1.5} style={{ color: 'var(--accent-purple)' }} />}
          </div>
          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{block.title}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: cat.bg, color: cat.color }}>
              {cat.label}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {block.intensity === 'P' ? '🔴 Pesada' : block.intensity === 'M' ? '🟡 Média' : '🟢 Leve'}
            </span>
            {totalSubs > 0 && (
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{doneSubs}/{totalSubs}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <button onClick={() => onSplit(block.id)}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all hover:bg-black/5"
              style={{ color: 'var(--accent-purple)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <Scissors size={10} strokeWidth={1.5} /> Dividir
            </button>
            <button onClick={() => onPomodoro(block.id)}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all hover:bg-black/5"
              style={{ color: 'var(--accent-green)', border: '1px solid rgba(31,59,50,0.12)' }}>
              <Timer size={10} strokeWidth={1.5} /> Pomodoro
            </button>
            <button onClick={() => onDelete(block.id)}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all hover:bg-black/5"
              style={{ color: 'var(--accent-9)', border: '1px solid rgba(215,137,127,0.15)' }}>
              <X size={10} strokeWidth={1.5} /> Remover
            </button>
          </div>
        </div>
      </div>

      {totalSubs > 0 && (
        <>
          <button onClick={() => onToggleExpand(block.id)}
            className="flex items-center gap-1 mt-2.5 ml-6 text-[11px] font-semibold"
            style={{ color: 'var(--accent-green)' }}>
            {expanded ? <ChevronUp size={12} strokeWidth={1.5} /> : <ChevronDown size={12} strokeWidth={1.5} />}
            {expanded ? 'Ocultar subtarefas' : `Ver ${totalSubs} subtarefas`}
          </button>
          {expanded && (
            <div className="ml-6 mt-2 space-y-1.5">
              {block.subtasks.map((sub) => (
                <button key={sub.id} onClick={() => onToggleSub(block.id, sub.id)}
                  className="flex items-center gap-2 w-full text-left p-2 rounded-xl transition-all hover:bg-black/3">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      background: sub.done ? 'var(--accent-green)' : 'transparent',
                      border: sub.done ? 'none' : '2px solid var(--text-muted)',
                    }}>
                    {sub.done && <Check size={12} color="white" strokeWidth={3} />}
                  </div>
                  <span className="text-[12px]" style={{
                    color: sub.done ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: sub.done ? 'line-through' : 'none',
                  }}>{sub.title}</span>
                </button>
              ))}
            </div>
          )}
          <div className="ml-6 mt-2">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(31,59,50,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(doneSubs / totalSubs) * 100}%`, background: 'var(--accent-green)' }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function PlannerScreen() {
  const { navigate } = useNavigation();
  const [dateOffset, setDateOffset] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showNewTask, setShowNewTask] = useState(false);
  const [showSplit, setShowSplit] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('10:00');
  const [newDuration, setNewDuration] = useState('60');
  const [newCategory, setNewCategory] = useState<Category>('trabalho');
  const [newIntensity, setNewIntensity] = useState<Intensity>('M');
  const [newNote, setNewNote] = useState('');

  const date = new Date();
  date.setDate(date.getDate() + dateOffset);
  const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });

  const currentDate = dateKey(dateOffset);

  const loadBlocks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<any[]>(`/api/timeline/${currentDate}`);
      const mapped: Block[] = data.map((b) => ({
        id: b.id,
        title: b.title,
        startTime: b.startTime,
        endTime: b.endTime,
        category: (['trabalho','pessoal','autocuidado','social','outro'].includes(b.category) ? b.category : 'outro') as Category,
        intensity: (['L','M','P'].includes(b.intensity) ? b.intensity : 'M') as Intensity,
        isAiSuggested: b.isAiSuggested ?? false,
        status: b.status ?? 'planned',
        subtasks: [],
      }));
      setBlocks(mapped);
    } catch {
      setBlocks([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const saveBlocks = async (blocksToSave: Block[], force = false): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/timeline', {
        method: 'POST',
        body: JSON.stringify({
          date: currentDate,
          forceSave: force,
          blocks: blocksToSave.map((b) => ({
            id: b.id.length === 36 ? b.id : undefined,
            title: b.title,
            startTime: b.startTime,
            endTime: b.endTime,
            category: b.category,
            intensity: b.intensity,
            status: b.status || 'planned',
          })),
        }),
      });
      if (!res.ok) {
        console.error('[planner] save failed:', res.status);
        setToast('Erro ao salvar bloco. Tente novamente.');
        return false;
      }
      return true;
    } catch (e) {
      console.error('[planner] save error:', e);
      setToast('Erro de conexão ao salvar. Verifique sua rede.');
      return false;
    }
  };

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

  const confirmSplit = async () => {
    if (!showSplit) return;
    setIsSplitting(true);
    const block = blocks.find(b => b.id === showSplit);
    if (!block) return;

    const [sh, sm] = block.startTime.split(':').map(Number);
    const [eh, em] = block.endTime.split(':').map(Number);
    const totalMin = (eh * 60 + em) - (sh * 60 + sm);
    const halfMin = Math.floor(totalMin / 2);
    const midH = Math.floor((sh * 60 + sm + halfMin) / 60);
    const midM = (sh * 60 + sm + halfMin) % 60;
    const midTime = `${midH.toString().padStart(2, '0')}:${midM.toString().padStart(2, '0')}`;

    const part1: Block = {
      ...block, id: `tmp-${Date.now()}-a`,
      title: `${block.title} (parte 1)`, endTime: midTime, intensity: 'M',
      subtasks: [],
    };
    const part2: Block = {
      ...block, id: `tmp-${Date.now()}-b`,
      title: `${block.title} (parte 2)`, startTime: midTime, intensity: 'L',
      isAiSuggested: true, subtasks: [],
    };

    const newBlocks = [...blocks.filter(b => b.id !== showSplit), part1, part2]
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    setBlocks(newBlocks);
    setShowSplit(null);
    setIsSplitting(false);
    setToast(`"${block.title}" foi dividida em 2 blocos`);
    const saved = await saveBlocks(newBlocks, true);
    if (saved) loadBlocks();
  };

  const handlePomodoro = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (block) navigate('pomodoro', { taskName: block.title });
  };

  const deleteBlock = async (blockId: string) => {
    // Optimistic update
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    try {
      await apiFetch(`/api/timeline/${blockId}`, { method: 'DELETE' });
    } catch {
      setToast('Erro ao remover bloco. Recarregando...');
      loadBlocks();
    }
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;
    setIsSaving(true);
    const dur = parseInt(newDuration) || 60;
    const [h, m] = newStart.split(':').map(Number);
    const endH = Math.floor((h * 60 + m + dur) / 60);
    const endM = (h * 60 + m + dur) % 60;
    const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    const tempBlock: Block = {
      id: `tmp-${Date.now()}`,
      title: newTitle.trim(),
      startTime: newStart,
      endTime,
      category: newCategory,
      intensity: newIntensity,
      isAiSuggested: false,
      status: 'planned',
      subtasks: [],
    };

    const newBlocks = [...blocks, tempBlock].sort((a, b) => a.startTime.localeCompare(b.startTime));
    setBlocks(newBlocks);
    setNewTitle('');
    setNewNote('');
    setShowNewTask(false);
    setToast(`"${tempBlock.title}" adicionada ao planner`);

    const saved = await saveBlocks([tempBlock], false);
    if (saved) loadBlocks();
    setIsSaving(false);
  };

  const splitBlock = showSplit ? blocks.find(b => b.id === showSplit) : null;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <button onClick={() => setDateOffset(d => d - 1)} className="p-2 rounded-xl hover:bg-black/5">
          <ChevronLeft size={22} strokeWidth={1.5} style={{ color: 'var(--text-primary)' }} />
        </button>
        <div className="text-center">
          <p className="text-[16px] font-bold capitalize" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {dateStr}
          </p>
          <p className="text-[10px] uppercase tracking-[2px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Timeline do Dia
          </p>
        </div>
        <button onClick={() => setDateOffset(d => d + 1)} className="p-2 rounded-xl hover:bg-black/5">
          <ChevronRight size={22} strokeWidth={1.5} style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 relative">
        {isLoading ? (
          <div className="flex justify-center pt-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="relative" style={{ minHeight: hours.length * 56 + 40 }}>
            {hours.map((hour) => (
              <div key={hour} className="absolute left-0 right-0 flex items-center" style={{ top: (hour - 6) * 56 }}>
                <div className="w-12 text-right pr-2">
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
                <div className="flex-1 h-px" style={{ background: 'rgba(31,59,50,0.06)' }} />
              </div>
            ))}

            {dateOffset === 0 && currentMinutes >= 360 && currentMinutes <= 1380 && (
              <div className="absolute left-12 right-0 flex items-center z-20"
                style={{ top: (currentMinutes - 360) * (56 / 60) }}>
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-rose)' }} />
                <div className="flex-1 h-[2px]" style={{ background: 'var(--accent-rose)', opacity: 0.5 }} />
              </div>
            )}

            <div className="absolute left-[52px] right-0" style={{ top: 0, bottom: 0 }}>
              {blocks.length === 0 && !isLoading && (
                <div className="text-center py-10 mt-8">
                  <p className="text-[14px] font-medium" style={{ color: 'var(--text-muted)' }}>Nenhum bloco para este dia</p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Toque + para adicionar uma tarefa</p>
                </div>
              )}
              {blocks.map((block) => {
                const [sh, sm] = block.startTime.split(':').map(Number);
                const [eh, em] = block.endTime.split(':').map(Number);
                const top = (sh * 60 + sm - 360) * (56 / 60);
                const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) * (56 / 60), 44);
                return (
                  <div key={block.id} style={{ position: 'absolute', top, left: 0, right: 0, minHeight: height }}>
                    <TimelineBlock
                      block={block}
                      onToggleSub={toggleSub}
                      onToggleExpand={toggleExpand}
                      expanded={!!expanded[block.id]}
                      onSplit={setShowSplit}
                      onPomodoro={handlePomodoro}
                      onDelete={deleteBlock}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showSplit && splitBlock && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSplit(null); }}>
          <div className="w-full rounded-t-[28px] p-5 animate-slide-up" style={{ background: 'var(--bg-base)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(31,59,50,0.15)' }} />
            <div className="flex items-center gap-2 mb-2">
              <Scissors size={18} strokeWidth={1.5} style={{ color: 'var(--accent-purple)' }} />
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                Dividir Tarefa
              </h3>
            </div>
            <p className="text-[13px] mb-4" style={{ color: 'var(--text-muted)' }}>
              Divide "{splitBlock.title}" em dois blocos menores.
            </p>
            <button onClick={confirmSplit} disabled={isSplitting}
              className="w-full py-[16px] rounded-[20px] text-white font-bold text-[15px] flex items-center justify-center gap-2"
              style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-lg)' }}>
              {isSplitting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Dividindo...</>
              ) : (
                <><Scissors size={18} strokeWidth={1.5} /> Confirmar divisão</>
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

            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="O que você precisa fazer?"
              className="w-full glass-card rounded-2xl px-4 py-3.5 text-[14px] outline-none mb-3"
              style={{ color: 'var(--text-primary)' }} autoFocus />

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                  <Clock size={10} strokeWidth={1.5} className="inline mr-1" /> Horário
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
              <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Categoria</label>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(catConfig) as [Category, typeof catConfig[Category]][]).map(([key, conf]) => (
                  <button key={key} onClick={() => setNewCategory(key)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-center transition-all"
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
                <Zap size={10} strokeWidth={1.5} /> Energia necessária
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

            <textarea placeholder="Notas (opcional)" value={newNote} onChange={e => setNewNote(e.target.value)}
              rows={2} className="w-full glass-card rounded-2xl px-4 py-3 text-[13px] outline-none resize-none mb-4"
              style={{ color: 'var(--text-primary)' }} />

            <button onClick={addTask} disabled={!newTitle.trim() || isSaving}
              className="w-full py-[16px] rounded-[20px] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-lg)', opacity: newTitle.trim() ? 1 : 0.5 }}>
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando...</>
              ) : 'Adicionar tarefa'}
            </button>
          </div>
        </div>
      )}

      <div className="absolute bottom-[88px] right-5 z-30">
        <button onClick={() => setShowNewTask(true)}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-[0.9]"
          style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-lg)' }}>
          <Plus size={26} color="white" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
