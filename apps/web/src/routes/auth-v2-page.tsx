import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useState } from 'react';
import { Mail, Lock, Eye, User, LogIn, UserPlus } from 'lucide-react';
import { useTranslation } from "react-i18next";

export const AuthV2Page = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('entrar'); // 'entrar' ou 'criar'

  const colors = {
    primary: '#5A7A64',
    bg: '#FFFFFF',
    inputBg: '#FFFFFF',
    textDark: '#181A1F',
    textLight: '#98A0AE'
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFBFB 100%)' }}>
      {/* Mockup do Celular */}
      <div className="w-full max-w-[380px] bg-white rounded-[3rem] shadow-[0_20px_48px_rgba(17,24,39,0.08)] overflow-hidden border border-black/5 relative aspect-[9/19.5]">
        
        {/* Status Bar Mockup */}
        <div className="h-10 flex justify-between items-center px-8 pt-4">
          <span className="text-xs font-bold">9:41</span>
          <div className="flex gap-1 items-center">
             <div className="w-4 h-2 bg-black rounded-full"></div>
             <div className="w-4 h-4 bg-black rounded-full"></div>
          </div>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 h-full overflow-y-auto" style={{ backgroundColor: colors.bg }}>
          
          {/* Card de Cabeçalho */}
          <div className="rounded-[2rem] p-8 text-white mb-6" style={{ background: 'linear-gradient(135deg, #5A7A64 0%, #4E6B57 100%)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-[10px] tracking-widest font-bold uppercase">Mood Energy</span>
            </div>
            <h1 className="text-2xl font-black leading-tight mb-4">
              {t("auth.heroTitle")}
            </h1>
            {activeTab === 'entrar' && (
              <p className="text-xs opacity-90 leading-relaxed">
                {t("auth.heroSubtitle")}
              </p>
            )}
          </div>

          {/* Seletor de Abas (Tabs) */}
          <div className="bg-white rounded-full p-1 flex mb-8 border border-black/5 shadow-[0_8px_18px_rgba(17,24,39,0.05)]">
            <AuraButtonV2 
              onClick={() => setActiveTab('entrar')}
              className={`flex-1 py-3 rounded-full text-sm font-bold transition-all ${activeTab === 'entrar' ? 'text-white shadow-md' : 'text-gray-500'}`}
              style={{ backgroundColor: activeTab === 'entrar' ? colors.primary : 'transparent' }}
            >
              {t("auth.signIn")}
            </AuraButtonV2>
            <AuraButtonV2 
              onClick={() => setActiveTab('criar')}
              className={`flex-1 py-3 rounded-full text-sm font-bold transition-all ${activeTab === 'criar' ? 'text-white shadow-md' : 'text-gray-500'}`}
              style={{ backgroundColor: activeTab === 'criar' ? colors.primary : 'transparent' }}
            >
              {t("auth.createAccount")}
            </AuraButtonV2>
          </div>

          {/* Formulário */}
          <div className="space-y-5">
            {activeTab === 'criar' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: colors.textLight }}>{t("auth.name")}</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Maria" 
                    className="w-full bg-white border border-orange-100 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-1"
                    style={{ borderColor: 'rgba(17,24,39,0.08)' }}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: colors.textLight }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="email" 
                  placeholder="voce@exemplo.com" 
                  className="w-full bg-white border border-orange-100 rounded-xl py-4 pl-12 pr-4 focus:outline-none"
                  style={{ borderColor: 'rgba(17,24,39,0.08)' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: colors.textLight }}>{t("auth.password")}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="password" 
                  placeholder={activeTab === 'entrar' ? "••••••••" : t("auth.recovery.minimum")}
                  className="w-full bg-white border border-orange-100 rounded-xl py-4 pl-12 pr-12 focus:outline-none"
                  style={{ borderColor: 'rgba(17,24,39,0.08)' }}
                />
                <Eye className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Botão de Ação */}
          <AuraButtonV2 
            className="w-full mt-10 py-5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
            style={{ backgroundColor: colors.primary }}
          >
            {activeTab === 'entrar' ? (
              <>
                <LogIn size={20} /> {t("auth.signInContinue")}
              </>
            ) : (
              <>
                <UserPlus size={20} /> {t("auth.createContinue")}
              </>
            )}
          </AuraButtonV2>

          {/* Rodapé */}
          {activeTab === 'entrar' && (
            <p className="text-center text-[11px] mt-6 text-gray-400">
              {t("auth.afterLogin")}
            </p>
          )}
          
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black/10 rounded-full"></div>
      </div>
    </div>
  );
};
