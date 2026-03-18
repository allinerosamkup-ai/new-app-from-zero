import React, { useState, useEffect } from 'react';
import { Target, Plus, ChevronDown, ChevronUp, Check, Sparkles, Brain, Trash2 } from 'lucide-react';
import { useNavigation } from '../navigation';
import { useObjectivesStore, SubGoal } from '../stores/objectives_store';

const catColors: Record<string, { color: string; bg: string }> = {
  saúde: { color: 'var(--cat-saude)', bg: 'rgba(16,185,129,0.08)' },
  saude: { color: 'var(--cat-saude)', bg: 'rgba(16,185,129,0.08)' },
  trabalho: { color: 'var(--cat-trabalho)', bg: 'rgba(59,130,246,0.08)' },
  lazer: { color: 'var(--cat-lazer)', bg: 'rgba(139,92,246,0.08)' },
  geral: { color: 'var(--accent-green)', bg: 'rgba(31,59,50,0.06)' },
};

const catFallback = { color: 'var(--accent-green)', bg: 'rgba(31,59,50,0.06)' };

export default function ObjectivesScreen() {
  const { navigate } = useNavigation();
  const { objectives, isLoading, error, load, create, toggleSubGoal, remove } = useObjectivesStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('geral');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => { load(); }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsCreating(true);
    const subgoals: SubGoal[] = [
      { id: `sg-${Date.now()}-1`, title: 'Definir meta específica e mensurável', done: false, aiGenerated: true },
      { id: `sg-${Date.now()}-2`, title: 'Identificar primeiro passo mínimo', done: false, aiGenerated: true },
      { id: `sg-${Date.now()}-3`, title: 'Agendar no planner desta semana', done: false, aiGenerated: true },
      { id: `sg-${Date.now()}-4`, title: 'Revisar progresso em 7 dias', done: false, aiGenerated: true },
    ];
    const obj = await create({ title: newTitle.trim(), category: newCategory, subgoals });
    if (obj) {
      setExpanded((prev) => ({ ...prev, [obj.id]: true }));
      setNewTitle('');
      setShowNew(false);
    }
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      <div className="px-5 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>Seus objetivos</p>
            <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Metas & Objetivos
            </h1>
          </div>
          <button onClick={() => navigate('harmony')}
            className="p-2.5 rounded-xl transition-colors"
            style={{ background: 'rgba(139,92,246,0.08)' }}>
            <Target size={20} style={{ color: 'var(--accent-purple)' }} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
          </div>
        )}

        {error && (
          <div className="glass-card rounded-[18px] p-3 mb-3 text-center">
            <p className="text-[12px]" style={{ color: 'var(--accent-rose)' }}>{error}</p>
          </div>
        )}

        {!isLoading && objectives.length === 0 && !showNew && (
          <div className="text-center py-12">
            <Target size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <p className="text-[14px] font-medium" style={{ color: 'var(--text-muted)' }}>Nenhum objetivo ainda</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Crie seu primeiro objetivo abaixo</p>
          </div>
        )}

        {objectives.map((obj, i) => {
          const cat = catColors[obj.category] ?? catFallback;
          const isExpandedObj = expanded[obj.id];
          const doneCount = obj.subgoals.filter((s) => s.done).length;
          return (
            <div key={obj.id} className="glass-card rounded-[22px] p-4 mb-3 animate-fade-in"
              style={{ animationDelay: `${i * 0.08}s` }}>
              <button onClick={() => toggleExpand(obj.id)} className="w-full text-left">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: cat.bg }}>
                    <Target size={18} style={{ color: cat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{obj.title}</p>
                    {obj.description && (
                      <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{obj.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(31,59,50,0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${obj.progress}%`, background: cat.color }} />
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: cat.color }}>{obj.progress}%</span>
                    </div>
                  </div>
                  <div className="mt-1">
                    {isExpandedObj ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> :
                      <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>
              </button>

              {isExpandedObj && (
                <div className="mt-3 ml-[52px]">
                  {obj.aiInsight && (
                    <div className="rounded-[14px] p-3 mb-3"
                      style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.05), rgba(45,212,191,0.05))' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Brain size={11} style={{ color: 'var(--accent-purple)' }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-purple)' }}>
                          Insight IA
                        </span>
                      </div>
                      <p className="text-[12px] leading-[18px] italic" style={{ color: 'var(--text-secondary)' }}>
                        {obj.aiInsight}
                      </p>
                    </div>
                  )}

                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Subtarefas ({doneCount}/{obj.subgoals.length})
                  </p>

                  {obj.subgoals.map((sub) => (
                    <button key={sub.id} onClick={() => toggleSubGoal(obj.id, sub.id)}
                      className="flex items-center gap-2 w-full text-left p-2 rounded-xl transition-all hover:bg-black/3 mb-1">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                        style={{
                          background: sub.done ? 'var(--accent-green)' : 'transparent',
                          border: sub.done ? 'none' : '2px solid var(--text-muted)',
                        }}>
                        {sub.done && <Check size={12} color="white" strokeWidth={3} />}
                      </div>
                      <span className="text-[12px] flex-1" style={{
                        color: sub.done ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: sub.done ? 'line-through' : 'none',
                      }}>
                        {sub.title}
                      </span>
                      {sub.aiGenerated && <Sparkles size={10} style={{ color: 'var(--accent-purple)', opacity: 0.5 }} />}
                    </button>
                  ))}

                  <button onClick={() => remove(obj.id)}
                    className="flex items-center gap-1.5 mt-3 p-2 rounded-xl transition-all hover:bg-black/3">
                    <Trash2 size={13} style={{ color: 'var(--accent-rose)' }} />
                    <span className="text-[12px]" style={{ color: 'var(--accent-rose)' }}>Remover objetivo</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={() => setShowNew(true)}
          className="w-full glass-card rounded-[20px] p-4 flex items-center justify-center gap-2 transition-all active:scale-[0.98] hover:shadow-md animate-fade-in"
          style={{ borderStyle: 'dashed', borderWidth: 2, borderColor: 'rgba(31,59,50,0.12)', background: 'transparent' }}>
          <Plus size={18} style={{ color: 'var(--accent-green)' }} />
          <span className="text-[14px] font-semibold" style={{ color: 'var(--accent-green)' }}>Novo objetivo</span>
        </button>
      </div>

      {showNew && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div className="w-full rounded-t-[28px] p-5 animate-slide-up" style={{ background: 'var(--bg-base)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(31,59,50,0.15)' }} />
            <h3 className="text-[16px] font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Novo Objetivo
            </h3>
            <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>
              Descreva sua meta e a IA vai quebrar em passos menores adaptados à sua ciclagem.
            </p>

            <textarea
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ex: Quero conseguir ler 30 minutos por dia sem perder foco..."
              className="w-full glass-card rounded-2xl px-4 py-3.5 text-[14px] outline-none resize-none h-24 mb-3"
              style={{ color: 'var(--text-primary)' }}
              autoFocus
            />

            <div className="mb-4">
              <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Categoria</label>
              <div className="flex gap-2">
                {['geral', 'saúde', 'trabalho', 'lazer'].map((cat) => (
                  <button key={cat} onClick={() => setNewCategory(cat)}
                    className="px-3 py-1.5 rounded-xl text-[12px] font-medium capitalize transition-all"
                    style={{
                      background: newCategory === cat ? 'var(--accent-green)' : 'rgba(31,59,50,0.06)',
                      color: newCategory === cat ? 'white' : 'var(--text-secondary)',
                    }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleCreate}
              disabled={!newTitle.trim() || isCreating}
              className="w-full py-[16px] rounded-[20px] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{
                background: newTitle.trim() ? 'var(--bg-dark)' : 'rgba(31,59,50,0.25)',
                boxShadow: newTitle.trim() ? 'var(--shadow-lg)' : 'none',
              }}>
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Criar objetivo
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
