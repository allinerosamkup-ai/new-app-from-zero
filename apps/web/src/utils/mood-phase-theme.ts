import type { MoodPhase } from "./mood-cycle-engine";

export type MoodPhaseTheme = {
  phase: MoodPhase;
  background: string;
  backgroundSubtle: string;
  surface: string;
  surfaceSoft: string;
  border: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  focusRing: string;
  auraGlow: string;
};

const PHASE_THEME: Record<MoodPhase, MoodPhaseTheme> = {
  elevated: {
    phase: "elevated", background: "#EEF5FB", backgroundSubtle: "#E2EFF9", surface: "#FFFFFF", surfaceSoft: "#F5FAFE", border: "#B7D3E8", accent: "#3E84B2", accentInk: "#060D12", accentSoft: "#D9EAF6", focusRing: "#26688F", auraGlow: "rgba(62, 132, 178, 0.28)",
  },
  flowing: {
    phase: "flowing", background: "#FEF3F0", backgroundSubtle: "#FCE5DE", surface: "#FFFFFF", surfaceSoft: "#FFF8F6", border: "#EDC5BA", accent: "#D98274", accentInk: "#1F2A36", accentSoft: "#F7DDD7", focusRing: "#B65E50", auraGlow: "rgba(217, 130, 116, 0.26)",
  },
  stable: {
    phase: "stable", background: "#F0F6F1", backgroundSubtle: "#E1EEE4", surface: "#FFFFFF", surfaceSoft: "#F7FBF7", border: "#BED7C4", accent: "#5E876F", accentInk: "#060D12", accentSoft: "#DCEBE0", focusRing: "#3F6A53", auraGlow: "rgba(94, 135, 111, 0.25)",
  },
  falling: {
    phase: "falling", background: "#FBF5EA", backgroundSubtle: "#F5E7CB", surface: "#FFFFFF", surfaceSoft: "#FFFAF1", border: "#E3C796", accent: "#BD8748", accentInk: "#1F2A36", accentSoft: "#F2E0BF", focusRing: "#946122", auraGlow: "rgba(189, 135, 72, 0.24)",
  },
  low: {
    phase: "low", background: "#F6F1F8", backgroundSubtle: "#EADFF0", surface: "#FFFFFF", surfaceSoft: "#FBF8FC", border: "#D1BDDD", accent: "#9275A6", accentInk: "#060D12", accentSoft: "#E6D9ED", focusRing: "#705183", auraGlow: "rgba(146, 117, 166, 0.23)",
  },
  depleted: {
    phase: "depleted", background: "#F0F2F7", backgroundSubtle: "#E0E4EE", surface: "#FFFFFF", surfaceSoft: "#F7F8FB", border: "#BEC5D8", accent: "#4A4F78", accentInk: "#FFFFFF", accentSoft: "#D9DCE8", focusRing: "#343A61", auraGlow: "rgba(74, 79, 120, 0.23)",
  },
  recovering: {
    phase: "recovering", background: "#EFF8F8", backgroundSubtle: "#DCEFEF", surface: "#FFFFFF", surfaceSoft: "#F7FCFC", border: "#B8DCDD", accent: "#4F9DA6", accentInk: "#1F2A36", accentSoft: "#D5ECEE", focusRing: "#317E87", auraGlow: "rgba(79, 157, 166, 0.24)",
  },
  mixed: {
    phase: "mixed", background: "#F4F1F8", backgroundSubtle: "#E6DFF0", surface: "#FFFFFF", surfaceSoft: "#FAF8FC", border: "#C9BCDA", accent: "#735A99", accentInk: "#FFFFFF", accentSoft: "#E0D8EB", focusRing: "#584076", auraGlow: "rgba(115, 90, 153, 0.26)",
  },
  insufficient_data: {
    phase: "insufficient_data", background: "#F5F7F9", backgroundSubtle: "#E9EDF1", surface: "#FFFFFF", surfaceSoft: "#FAFBFC", border: "#D0D7DF", accent: "#7C8796", accentInk: "#060D12", accentSoft: "#E5E9ED", focusRing: "#5A6572", auraGlow: "rgba(124, 135, 150, 0.18)",
  },
};

export function getMoodPhaseTheme(phase: MoodPhase | null | undefined): MoodPhaseTheme {
  return PHASE_THEME[phase ?? "insufficient_data"];
}

export function toMoodPhaseCssVars(theme: MoodPhaseTheme): Record<`--${string}`, string> {
  return {
    "--phase-bg": theme.background,
    "--phase-bg-subtle": theme.backgroundSubtle,
    "--phase-surface": theme.surface,
    "--phase-surface-soft": theme.surfaceSoft,
    "--phase-border": theme.border,
    "--phase-accent": theme.accent,
    "--phase-accent-ink": theme.accentInk,
    "--phase-accent-soft": theme.accentSoft,
    "--phase-focus-ring": theme.focusRing,
    "--phase-aura-glow": theme.auraGlow,
  };
}

export const MOOD_PHASE_THEME = PHASE_THEME;
