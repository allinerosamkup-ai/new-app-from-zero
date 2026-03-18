import React, { useState } from 'react';
import { useNavigation } from '../navigation';
import { useAuthStore } from '../stores/auth_store';

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const { navigate } = useNavigation();
  const { signIn, signUp, isLoading, error, infoMessage, clearMessages } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSignup = mode === 'signup';

  const handleSubmit = async () => {
    clearMessages();
    if (isSignup) {
      const ok = await signUp({ fullName, email, password });
      if (ok && !useAuthStore.getState().infoMessage) navigate('onboarding');
    } else {
      const ok = await signIn(email, password);
      if (ok) navigate('home');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 py-5" style={{ background: 'var(--bg-base)' }}>
      <div className="flex-1 flex flex-col justify-between min-h-0">
        <div>
          <div className="rounded-[28px] px-6 py-7 animate-fade-in" style={{ background: 'var(--bg-dark)' }}>
            <p className="text-[11px] uppercase tracking-[3px] font-semibold" style={{ color: 'var(--accent-teal)', opacity: 0.9 }}>
              Mood Energy
            </p>
            <h1 className="mt-3 text-[24px] font-bold leading-tight" style={{ color: 'var(--text-on-dark)', fontFamily: 'var(--font-heading)' }}>
              Seu ritmo merece um ponto de partida mais gentil.
            </h1>
            <p className="mt-3 text-[14px] leading-6" style={{ color: 'var(--text-on-dark-muted)' }}>
              Acompanhe humor, energia e rotina em um fluxo que respeita sua ciclagem.
            </p>
          </div>

          <div className="mt-5 flex rounded-2xl p-1 glass-strong animate-fade-in delay-100">
            <button
              onClick={() => { setMode('signin'); clearMessages(); }}
              className="flex-1 rounded-xl px-4 py-3 text-center font-semibold text-sm transition-all duration-300"
              style={{
                background: mode === 'signin' ? 'var(--bg-dark)' : 'transparent',
                color: mode === 'signin' ? 'white' : 'var(--text-secondary)',
              }}
            >
              Entrar
            </button>
            <button
              onClick={() => { setMode('signup'); clearMessages(); }}
              className="flex-1 rounded-xl px-4 py-3 text-center font-semibold text-sm transition-all duration-300"
              style={{
                background: mode === 'signup' ? 'var(--bg-dark)' : 'transparent',
                color: mode === 'signup' ? 'white' : 'var(--text-secondary)',
              }}
            >
              Criar conta
            </button>
          </div>

          <div className="mt-5 space-y-4 animate-fade-in delay-200">
            {isSignup && (
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[2px]" style={{ color: 'var(--text-muted)' }}>
                  Seu nome
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Como você quer ser chamada?"
                  className="w-full rounded-2xl px-4 py-4 text-[15px] outline-none transition-all duration-200 glass-card focus:shadow-md"
                  style={{ color: 'var(--text-primary)', borderColor: 'var(--border-interactive)' }}
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[2px]" style={{ color: 'var(--text-muted)' }}>
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                type="email"
                className="w-full rounded-2xl px-4 py-4 text-[15px] outline-none transition-all duration-200 glass-card focus:shadow-md"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border-interactive)' }}
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[2px]" style={{ color: 'var(--text-muted)' }}>
                Senha
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                type="password"
                className="w-full rounded-2xl px-4 py-4 text-[15px] outline-none transition-all duration-200 glass-card focus:shadow-md"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border-interactive)' }}
              />
            </div>
          </div>

          {(error || infoMessage) && (
            <div
              className="mt-4 rounded-2xl px-4 py-3 text-[13px] animate-fade-in"
              style={{
                background: error ? 'rgba(220,80,80,0.08)' : 'rgba(31,59,50,0.08)',
                color: error ? 'var(--accent-rose)' : 'var(--accent-green)',
              }}
            >
              {error || infoMessage}
            </div>
          )}
        </div>

        <div className="pb-2 animate-fade-in delay-300">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="btn-aura w-full rounded-[24px] px-6 py-[18px] text-center text-[16px] font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'var(--accent-9)', boxShadow: '0 4px 14px rgba(215,137,127,.35)' }}
          >
            {isLoading ? 'Aguarde...' : isSignup ? 'Criar conta e continuar' : 'Entrar e continuar'}
          </button>
          <p className="mt-4 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {isSignup
              ? 'Ao continuar, você cria sua conta e segue para o onboarding.'
              : 'Depois do login, seguimos direto para seu dia.'}
          </p>
        </div>
      </div>
    </div>
  );
}
