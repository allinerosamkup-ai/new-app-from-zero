import { useEffect, useState } from "react";

/**
 * Retorno visual de uma conclusão.
 *
 * Existe por um motivo específico: fechar uma tarefa sem nada acontecer não
 * registra como conquista. O retorno tem que chegar no mesmo segundo do toque,
 * durar pouco e sair sozinho — se pedir para ser fechado, vira mais uma tarefa.
 *
 * Respeita `prefers-reduced-motion`: quem pediu menos movimento recebe o texto
 * sem a animação, não o silêncio.
 */

export type Reward = {
  headline: string;
  detail?: string | null;
  animation?: "spark" | "confetti" | "pulse" | "streak" | string;
  intensity?: "small" | "big" | string;
  xpEarned?: number;
};

const ICON_BY_ANIMATION: Record<string, string> = {
  spark: "✨",
  confetti: "🎉",
  pulse: "💛",
  streak: "🔥",
};

const DURATION_MS = { small: 1600, big: 2600 } as const;

export function RewardBurst({ reward, onDone }: { reward: Reward | null; onDone?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!reward) return;
    setVisible(true);
    const big = reward.intensity === "big";
    const timer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, big ? DURATION_MS.big : DURATION_MS.small);
    return () => clearTimeout(timer);
  }, [reward]);

  if (!reward || !visible) return null;

  const big = reward.intensity === "big";
  const icon = ICON_BY_ANIMATION[reward.animation ?? "spark"] ?? "✨";

  return (
    <div
      // Anúncio educado: leitor de tela recebe a conquista sem interromper o foco.
      role="status"
      aria-live="polite"
      className={`reward-burst reward-burst--${reward.animation ?? "spark"}${big ? " reward-burst--big" : ""}`}
    >
      <span className="reward-burst__icon" aria-hidden="true">{icon}</span>
      <span className="reward-burst__text">
        <strong>{reward.headline}</strong>
        {reward.detail ? <em>{reward.detail}</em> : null}
      </span>
      {/* O XP já vinha do backend desde sempre e nunca era mostrado — a pessoa
          ganhava pontos sem ver que ganhou. Só número e sigla, sem palavra
          traduzível, então não muda entre idiomas. */}
      {typeof reward.xpEarned === "number" && reward.xpEarned > 0 && (
        <span className="reward-burst__xp">+{reward.xpEarned} XP</span>
      )}
      {big && (
        <span className="reward-burst__sparks" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <i key={index} style={{ ["--i" as string]: String(index) }} />
          ))}
        </span>
      )}
      <style>{`
        .reward-burst {
          position: fixed;
          left: 50%;
          bottom: calc(96px + env(safe-area-inset-bottom, 0px));
          transform: translateX(-50%);
          z-index: 9000;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(169,210,187, 0.36);
          box-shadow: 0 14px 34px rgba(169,210,187, 0.22);
          backdrop-filter: blur(18px);
          pointer-events: none;
          animation: rewardIn 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reward-burst__icon { font-size: 20px; }
        .reward-burst--big .reward-burst__icon { font-size: 26px; animation: rewardPop 620ms ease-out; }
        .reward-burst__text { display: flex; flex-direction: column; line-height: 1.25; }
        .reward-burst__xp {
          flex-shrink: 0;
          padding: 3px 9px;
          border-radius: 999px;
          background: var(--accent-primary-a3, rgba(191,220,203,.16));
          color: var(--accent-primary-ink, #4F7359);
          font-size: 11px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .reward-burst--big .reward-burst__xp { font-size: 13px; padding: 4px 11px; }
        .reward-burst__text strong {
          font-size: 14px; font-weight: 800; color: var(--text-1, #2b2320);
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .reward-burst__text em {
          font-style: normal; font-size: 11.5px; font-weight: 650;
          color: var(--text-3, #8a7a72);
        }
        .reward-burst__sparks { position: absolute; inset: 0; overflow: visible; }
        .reward-burst__sparks i {
          position: absolute; left: 50%; top: 50%;
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(169,210,187, 0.9);
          animation: rewardSpark 900ms ease-out forwards;
          animation-delay: calc(var(--i) * 40ms);
          transform: rotate(calc(var(--i) * 60deg)) translateY(0);
        }
        @keyframes rewardIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.94); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes rewardPop {
          0%   { transform: scale(0.6); }
          55%  { transform: scale(1.28); }
          100% { transform: scale(1); }
        }
        @keyframes rewardSpark {
          from { opacity: 1; transform: rotate(calc(var(--i) * 60deg)) translateY(0) scale(1); }
          to   { opacity: 0; transform: rotate(calc(var(--i) * 60deg)) translateY(-42px) scale(0.4); }
        }
        @media (prefers-reduced-motion: reduce) {
          .reward-burst { animation: none; }
          .reward-burst__icon, .reward-burst__sparks i { animation: none; }
          .reward-burst__sparks { display: none; }
        }
      `}</style>
    </div>
  );
}
