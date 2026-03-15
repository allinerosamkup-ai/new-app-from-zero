import React, { useState } from 'react';
import { useNavigation } from '../navigation';

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const { navigate } = useNavigation();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSignup = mode === 'signup';

  const handleSubmit = () => {
    if (isSignup) {
      navigate('onboarding');
    } else {
      navigate('home');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f6f3ed] overflow-y-auto px-6 py-6">
      <div className="flex-1 flex flex-col justify-between min-h-0">
        <div>
          <div className="rounded-[32px] bg-[#1f3b32] px-6 py-8">
            <p className="text-[#f7efe1] text-xs uppercase tracking-[3px] font-medium">Mood Energy</p>
            <h1 className="mt-3 text-[#fff7eb] text-[26px] font-bold leading-tight">
              Seu ritmo merece um ponto de partida mais gentil.
            </h1>
            <p className="mt-3 text-[#d8e5dc] text-[15px] leading-6">
              Entre para acompanhar humor, energia e rotina em um fluxo que respeita o seu estado real.
            </p>
          </div>

          <div className="mt-6 flex rounded-2xl bg-white p-1">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 rounded-2xl px-4 py-3 text-center font-semibold transition-colors ${
                mode === 'signin' ? 'bg-[#1f3b32] text-white' : 'bg-transparent text-[#4d4a45]'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-2xl px-4 py-3 text-center font-semibold transition-colors ${
                mode === 'signup' ? 'bg-[#1f3b32] text-white' : 'bg-transparent text-[#4d4a45]'
              }`}
            >
              Criar conta
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {isSignup && (
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[2px] text-[#7b756c]">
                  Seu nome
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Como você quer ser chamada?"
                  className="w-full rounded-2xl bg-white px-4 py-4 text-base text-[#1f1b16] placeholder-[#9b9489] outline-none"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[2px] text-[#7b756c]">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                type="email"
                className="w-full rounded-2xl bg-white px-4 py-4 text-base text-[#1f1b16] placeholder-[#9b9489] outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[2px] text-[#7b756c]">
                Senha
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                type="password"
                className="w-full rounded-2xl bg-white px-4 py-4 text-base text-[#1f1b16] placeholder-[#9b9489] outline-none"
              />
            </div>
          </div>
        </div>

        <div className="pb-2">
          <button
            onClick={handleSubmit}
            className="w-full rounded-[28px] bg-[#1f3b32] px-6 py-5 text-center text-lg font-bold text-white active:bg-[#2a4d40] transition-colors"
          >
            {isSignup ? 'Criar conta e continuar' : 'Entrar e continuar'}
          </button>
          <p className="mt-4 text-center text-sm text-[#6f6a62]">
            {isSignup
              ? 'Ao continuar, você cria sua conta e segue para o onboarding.'
              : 'Depois do login, seguimos direto para a configuração inicial do app.'}
          </p>
        </div>
      </div>
    </div>
  );
}
