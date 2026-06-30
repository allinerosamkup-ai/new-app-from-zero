import { NavLink } from "react-router-dom";
import { Card } from "../ui/card";

const items = [
  { to: "/home", label: "Seu dia" },
  { to: "/journal", label: "Diário IA" },
  { to: "/goals", label: "Objetivos" },
  { to: "/onboarding", label: "Onboarding" },
  { to: "/profile", label: "Perfil" },
  { to: "/preferences", label: "Preferências" },
];

export function AuraSidebar() {
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
        <span className="aura-label">Foco total</span>
        <h3>50m</h3>
        <p>
          Bom ritmo! Sua energia está no pico — aproveite para as tarefas mais
          exigentes.
        </p>
      </Card>
    </aside>
  );
}
