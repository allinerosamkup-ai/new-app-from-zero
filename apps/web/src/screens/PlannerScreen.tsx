import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Lightbulb, Sparkles } from 'lucide-react';

const MOCK_BLOCKS = [
  { id: '1', title: 'Meditação matinal', startTime: '07:00', endTime: '07:30', category: 'saúde' as const, intensity: 'L', isAiSuggested: true },
  { id: '2', title: 'Foco no projeto', startTime: '09:00', endTime: '11:00', category: 'trabalho' as const, intensity: 'P', isAiSuggested: false },
  { id: '3', title: 'Almoço & descanso', startTime: '12:00', endTime: '13:00', category: 'lazer' as const, intensity: 'L', isAiSuggested: false },
  { id: '4', title: 'Reunião de alinhamento', startTime: '14:00', endTime: '15:00', category: 'trabalho' as const, intensity: 'M', isAiSuggested: false },
  { id: '5', title: 'Caminhada', startTime: '17:00', endTime: '17:45', category: 'saúde' as const, intensity: 'L', isAiSuggested: true },
  { id: '6', title: 'Leitura', startTime: '21:00', endTime: '22:00', category: 'lazer' as const, intensity: 'L', isAiSuggested: false },
];

const categoryColors: Record<string, { bg: string; border: string }> = {
  trabalho: { bg: 'bg-blue-100', border: 'border-blue-300' },
  saúde: { bg: 'bg-green-100', border: 'border-green-300' },
  lazer: { bg: 'bg-purple-100', border: 'border-purple-300' },
};

export default function PlannerScreen() {
  const [dateOffset, setDateOffset] = useState(0);
  const date = new Date();
  date.setDate(date.getDate() + dateOffset);
  const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });

  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100">
        <button onClick={() => setDateOffset((d) => d - 1)} className="p-2">
          <ChevronLeft size={24} className="text-gray-700" />
        </button>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800 capitalize">{dateStr}</p>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Timeline do Dia</p>
        </div>
        <button onClick={() => setDateOffset((d) => d + 1)} className="p-2">
          <ChevronRight size={24} className="text-gray-700" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <div className="relative" style={{ height: hours.length * 60 + 40 }}>
          {hours.map((hour) => {
            const top = (hour - 6) * 60;
            return (
              <div key={hour} className="absolute left-0 right-0 flex items-center" style={{ top }}>
                <div className="w-14 text-right pr-2">
                  <span className="text-[10px] text-gray-400 font-medium">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            );
          })}

          {MOCK_BLOCKS.map((block) => {
            const [sh, sm] = block.startTime.split(':').map(Number);
            const [eh, em] = block.endTime.split(':').map(Number);
            const top = (sh - 6) * 60 + sm;
            const height = Math.max((eh * 60 + em) - (sh * 60 + sm), 30);
            const colors = categoryColors[block.category] || categoryColors.outro;

            return (
              <div
                key={block.id}
                className={`absolute left-[60px] right-4 p-2 rounded-xl border-l-4 ${colors.bg} ${colors.border}`}
                style={{ top, height }}
              >
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-[11px] truncate">{block.title}</span>
                  {block.isAiSuggested && <Sparkles size={10} className="text-purple-600 flex-shrink-0" />}
                </div>
                <span className="text-[9px] text-gray-500 font-medium">
                  {block.startTime} — {block.endTime}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-20 left-6 right-6 flex justify-between items-center pointer-events-none">
        <button className="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center shadow-lg pointer-events-auto">
          <Lightbulb size={24} className="text-white" />
        </button>
        <button className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-xl border-4 border-white pointer-events-auto">
          <Plus size={32} className="text-white" />
        </button>
      </div>
    </div>
  );
}
