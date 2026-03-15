import React, { useState } from 'react';
import { useNavigation } from '../navigation';

function MoodSelector({ value, onSelect }: { value: number; onSelect: (v: number) => void }) {
  const emojis = ['😢', '😕', '😐', '🙂', '😄'];
  const labels = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Muito bem'];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Como está seu humor agora?</h3>
      <div className="flex justify-between">
        {emojis.map((emoji, index) => {
          const score = index + 1;
          const isSelected = value === score;
          return (
            <button
              key={score}
              onClick={() => onSelect(score)}
              className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-colors ${
                isSelected ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <span className="text-[32px]">{emoji}</span>
              {isSelected && (
                <span className="text-blue-600 text-xs font-bold mt-1">{labels[index]}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScoreSelector({ label, value, onSelect }: { label: string; value: number; onSelect: (v: number) => void }) {
  return (
    <div className="mb-6">
      <p className="text-gray-800 font-medium mb-3">{label}</p>
      <div className="flex justify-between bg-gray-100 p-1 rounded-xl">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            onClick={() => onSelect(score)}
            className={`flex-1 py-3 rounded-lg text-center font-bold transition-all ${
              value === score ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
            }`}
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
    navigate('checkinResult');
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto p-4">
      <h1 className="text-xl font-bold mb-6 text-center text-gray-800">Como você está hoje?</h1>

      <MoodSelector value={mood} onSelect={setMood} />
      <ScoreSelector label="Como está seu nível de energia?" value={energy} onSelect={setEnergy} />
      <ScoreSelector label="Como está sua clareza mental?" value={clarity} onSelect={setClarity} />
      <ScoreSelector label="Nível de irritabilidade" value={irritability} onSelect={setIrritability} />

      <div className="mt-2">
        <p className="text-gray-700 mb-2 text-sm">Quer comentar algo sobre o momento?</p>
        <textarea
          className="w-full border border-gray-300 rounded-lg p-3 h-20 text-sm resize-none outline-none focus:border-blue-400"
          placeholder="Ex: Dormi pouco, mas me sinto bem..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <button
        onClick={handleSubmit}
        className="mt-6 mb-6 p-4 rounded-xl bg-blue-600 text-white font-bold text-lg text-center active:bg-blue-700 transition-colors"
      >
        Confirmar check-in
      </button>
    </div>
  );
}
