import React from 'react';
import { User, LogOut, Shield, ChevronRight } from 'lucide-react';

export default function ConfigScreen() {
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
