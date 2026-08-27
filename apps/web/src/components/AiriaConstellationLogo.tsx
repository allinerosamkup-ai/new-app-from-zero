import { AuraIcon } from "./AuraIcon";

/**
 * Marca da splash pública. O cluster de círculos saiu; o ser orbital
 * é a mesma identidade da Home, da nav e dos ícones do PWA.
 */
export function AiriaConstellationLogo({
  size = 84,
  hybrid = false,
}: {
  size?: number;
  hybrid?: boolean;
}) {
  void hybrid;
  return <AuraIcon size={size} />;
}
