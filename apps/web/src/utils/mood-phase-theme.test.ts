import { describe, expect, it } from "vitest";
import { PHASE_CONFIG } from "./mood-cycle-engine";
import { MOOD_PHASE_THEME, getMoodPhaseTheme, toMoodPhaseCssVars } from "./mood-phase-theme";

function luminance(hex: string) {
  const coefficients = [0.2126, 0.7152, 0.0722];
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];

  return channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * coefficients[index];
  }, 0);
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("mood phase theme", () => {
  it("assigns an exclusive accent family to every real phase", () => {
    const realPhases = ["elevated", "flowing", "stable", "falling", "low", "depleted", "recovering", "mixed"] as const;
    const accents = realPhases.map((phase) => MOOD_PHASE_THEME[phase].accent);

    expect(new Set(accents).size).toBe(realPhases.length);
    expect(MOOD_PHASE_THEME.stable.accent).toBe("#5E876F");
  });

  it("uses the neutral calibration theme when no phase is available", () => {
    expect(getMoodPhaseTheme(null)).toBe(MOOD_PHASE_THEME.insufficient_data);
    expect(getMoodPhaseTheme(undefined)).toBe(MOOD_PHASE_THEME.insufficient_data);
  });

  it("exports all shell tokens required by the phase theme", () => {
    const vars = toMoodPhaseCssVars(MOOD_PHASE_THEME.mixed);

    expect(vars).toMatchObject({
      "--phase-bg": "#F4F1F8",
      "--phase-accent": "#735A99",
      "--phase-accent-ink": "#FFFFFF",
      "--phase-focus-ring": "#584076",
    });
  });

  it("keeps action text and keyboard focus perceptible across every phase", () => {
    Object.values(MOOD_PHASE_THEME).forEach((theme) => {
      expect(contrast(theme.accent, theme.accentInk)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.focusRing, theme.background)).toBeGreaterThanOrEqual(3);
    });
  });

  it("shares its accent source with the mood-cycle metadata", () => {
    Object.entries(MOOD_PHASE_THEME).forEach(([phase, theme]) => {
      expect(PHASE_CONFIG[phase as keyof typeof PHASE_CONFIG].color).toBe(theme.accent);
    });
  });
});
