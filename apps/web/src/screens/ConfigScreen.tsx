import React, { useState } from 'react';
import { User, LogOut, Shield, ChevronRight, Clock, Sun, Moon, Bot } from 'lucide-react';

export default function ConfigScreen() {
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [aiTone, setAiTone] = useState<'gentil' | 'direto' | 'motivador'>('gentil');

  const toneOptions = [
    { value: 'gentil' as const, label: 'Gentil', desc: 'Acolhedor e empático' },
    { value: 'direto' as const, label: 'Direto', desc: 'Objetivo e prático' },
    { value: 'motivador' as const, label: 'Motivador', desc: 'Energizante e positivo' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 p-6 overflow-y-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h1>

      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mr-4">
            <User size={26} className="text-sky-600" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-gray-900">Ana Silva</p>
            <p className="text-sm text-gray-500 mt-0.5">ana.silva@email.com</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Rotina</p>

        <div className="mb-4">
          <div className="flex items-center mb-2">
            <Clock size={16} className="text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-700">Fuso horário</span>
          </div>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400"
          >
            <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
            <option value="America/Manaus">Manaus (GMT-4)</option>
            <option value="America/Bahia">Bahia (GMT-3)</option>
            <option value="America/Recife">Recife (GMT-3)</option>
            <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
          </select>
        </div>

        <div className="flex gap-4 mb-2">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <Sun size={16} className="text-amber-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">Acordar</span>
            </div>
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <Moon size={16} className="text-indigo-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">Dormir</span>
            </div>
            <input
              type="time"
              value={sleepTime}
              onChange={(e) => setSleepTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center mb-4">
          <Bot size={16} className="text-purple-500 mr-2" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tom da IA</p>
        </div>
        <div className="space-y-2">
          {toneOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAiTone(opt.value)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors text-left ${
                aiTone === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div>
                <p className={`text-sm font-bold ${aiTone === opt.value ? 'text-blue-700' : 'text-gray-800'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
              {aiTone === opt.value && (
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl mb-4 overflow-hidden">
        <button className="w-full flex items-center px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
          <Shield size={20} className="text-slate-500" />
          <span className="flex-1 ml-3 text-base text-gray-700 text-left">Privacidade e dados</span>
          <ChevronRight size={18} className="text-slate-400" />
        </button>
      </div>

      <button className="bg-white rounded-2xl px-5 py-4 flex items-center hover:bg-gray-50 transition-colors">
        <LogOut size={20} className="text-red-500" />
        <span className="ml-3 text-base font-semibold text-red-500">Sair da conta</span>
      </button>

      <p className="text-center text-xs text-gray-400 mt-8">
        Mood & Energy — MVP v1.0
      </p>
    </div>
  );
}
