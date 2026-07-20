import { NavLink } from "react-router-dom";
import { Card } from "../ui/card";
import { useLocalizedCopy } from "../../i18n";

export function AuraSidebar() {
  const l = useLocalizedCopy();
  const items = [
    { to: "/home", label: l("Seu dia", "Your day") },
    { to: "/journal", label: l("Diário IA", "AI Journal") },
    { to: "/goals", label: l("Objetivos", "Goals") },
    { to: "/onboarding", label: "Onboarding" },
    { to: "/profile", label: l("Perfil", "Profile") },
    { to: "/preferences", label: l("Preferências", "Preferences") },
  ];
  return (
    <aside className="aura-sidebar">
      <div className="aura-brand">
        <span className="aura-brand__dot" />
        <div>
          <strong>Airia</strong>
          <p>Mood Energy</p>
        </div>
      </div>

      <nav className="aura-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "aura-nav__item active" : "aura-nav__item"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Card className="aura-sidebar-card">
        <span className="aura-label">{l("Foco total", "Full focus")}</span>
        <h3>50m</h3>
        <p>
          {l("Bom ritmo! Sua energia está no pico — aproveite para as tarefas mais exigentes.", "Good rhythm! Your energy is peaking — use it for the most demanding tasks.")}
        </p>
      </Card>
    </aside>
  );
}
