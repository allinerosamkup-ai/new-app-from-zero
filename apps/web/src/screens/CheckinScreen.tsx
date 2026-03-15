import React, { useState } from 'react';
import { useNavigation } from '../navigation';
import { ArrowLeft } from 'lucide-react';

function MoodSelector({ value, onSelect }: { value: number; onSelect: (v: number) => void }) {
  const emojis = ['😞', '😐', '🙂', '😊', '😄'];
  const labels = ['Muito mal', 'Neutro', 'Bem', 'Muito bem', 'Ótimo'];

  return (
    <div className="mb-7 animate-fade-in delay-100">
      <h3 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
        Como está seu humor agora?
      </h3>
      <div className="flex justify-between gap-1">
        {emojis.map((emoji, index) => {
          const score = index + 1;
          const isSelected = value === score;
          return (
            <button
              key={score}
              onClick={() => onSelect(score)}
              className="flex flex-col items-center p-2.5 rounded-2xl transition-all duration-200"
              style={{
                background: isSelected ? 'rgba(31,59,50,0.08)' : 'transparent',
                border: isSelected ? '2px solid var(--accent-green)' : '2px solid transparent',
                transform: isSelected ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              <span className="text-[28px]">{emoji}</span>
              {isSelected && (
                <span className="text-[10px] font-bold mt-1" style={{ color: 'var(--accent-green)' }}>{labels[index]}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EnergySlider({ label, value, onSelect, icon }: { label: string; value: number; onSelect: (v: number) => void; icon: string }) {
  return (
    <div className="mb-6 animate-fade-in delay-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            onClick={() => onSelect(score)}
            className="flex-1 py-3 rounded-xl text-center font-bold text-[14px] transition-all duration-200"
            style={{
              background: value === score ? 'var(--bg-dark)' : 'var(--bg-glass-strong)',
              color: value === score ? 'white' : 'var(--text-secondary)',
              boxShadow: value === score ? 'var(--shadow-md)' : 'none',
            }}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CheckinScreen() {
  const { navigate } = useNavigation();
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [clarity, setClarity] = useState(3);
  const [irritability, setIrritability] = useState(2);
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    const avg = (mood + energy + clarity + (6 - irritability)) / 4;
    const state = avg >= 4 ? 'leve' : avg >= 3 ? 'moderado' : avg >= 2 ? 'sensível' : 'crítico';
    navigate('checkinResult', { state });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center px-5 pt-2 pb-3">
        <button onClick={() => navigate('home')} className="p-2 -ml-2 rounded-xl transition-colors hover:bg-black/5">
          <ArrowLeft size={22} style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      <div className="px-5 pb-6">
        <h1 className="text-[20px] font-bold mb-1 animate-fade-in" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Como você está hoje?
        </h1>
        <p className="text-[13px] mb-6 animate-fade-in" style={{ color: 'var(--text-muted)' }}>
          Responda rápido, sem pensar demais. Não tem certo ou errado.
        </p>

        <MoodSelector value={mood} onSelect={setMood} />
        <EnergySlider label="Nível de energia" value={energy} onSelect={setEnergy} icon="⚡" />
        <EnergySlider label="Clareza mental" value={clarity} onSelect={setClarity} icon="🧠" />
        <EnergySlider label="Irritabilidade" value={irritability} onSelect={setIrritability} icon="🌡️" />

        <div className="mt-2 mb-6 animate-fade-in delay-300">
          <p className="text-[13px] mb-2" style={{ color: 'var(--text-secondary)' }}>Quer comentar algo? (opcional)</p>
          <textarea
            className="w-full glass-card rounded-2xl p-4 text-[14px] resize-none outline-none h-20 transition-all focus:shadow-md"
            placeholder="Ex: Dormi pouco, mas me sinto bem..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        <button
          onClick={handleSubmit}
          className="w-full py-[18px] rounded-[20px] text-white font-bold text-[16px] transition-all duration-200 active:scale-[0.98] animate-fade-in delay-400"
          style={{ background: 'var(--bg-dark)', boxShadow: 'var(--shadow-lg)' }}
        >
          Confirmar check-in
        </button>
      </div>
    </div>
  );
}
