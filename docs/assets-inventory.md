# 🌿 Verdant Sanctuary — Design Inventory (v5)

Este inventário define o sistema visual "Glass Greenhouse" — orgânico, respirável e intencionalmente suave.

---

## 🎨 1. Paleta de Cores (Tokens)

| Token | Hex/Valor | Uso Semântico |
| :--- | :--- | :--- |
| `--primary` | `#8a4e4d` | Ações principais, Rosa Orgânico Terroso |
| `--primary-container`| `#fdb0ad` | Fundos de botões e acentos claros |
| `--secondary` | `#486650` | Verde Floresta (Saúde e Estabilidade) |
| `--secondary-fixed` | `#d1f4d7` | Acentos de sucesso e bem-estar |
| `--tertiary` | `#695a6e` | Lavanda Mudo (Reflexão e Sono) |
| `--background` | `#ecfcff` | Fundo principal (Ciano Respirável) |
| `--on-surface` | `#00383e` | Texto principal e ícones escuros |
| `--glass-bg` | `rgba(255,255,255,0.4)` | Fundo de painéis translúcidos |
| `--glass-border` | `rgba(255,255,255,0.3)` | Bordas sutis de refração |

---

## 💎 2. Elementos Glass (Efeitos)

### Glass Panel (Cards)
- **Blur:** `12px`
- **Border:** `1px solid var(--glass-border)`
- **Shadow:** `0 20px 40px rgba(0, 56, 62, 0.06)`
- **Radius:** `1rem` (Default), `2rem` (Large), `3rem` (Extra Large)

### Glass Icon (Botões de Ícone)
- **Background:** `rgba(255, 255, 255, 0.2)`
- **Hover:** `rgba(255, 255, 255, 0.5)` + `translateY(-2px)`

---

## 🔘 3. Sistema de Botões (AuraButtonV2)

Todos os botões devem usar o formato **Full Pill** (arredondamento máximo).

| Variante | Estilo Visual | Classe CSS |
| :--- | :--- | :--- |
| **Primary Fill** | Gradiente `#8a4e4d` → `#fdb0ad`, Texto Branco | `.btn-aura-primary` |
| **Secondary Glass**| Glass semi-opaco, Texto `#8a4e4d` | `.btn-aura-glass` |
| **Outline Pill** | Borda 2px Rosa Orgânico, Sem fundo | `.btn-aura-outline` |
| **Ghost Link** | Sem borda, Sem fundo, Texto `#695a6e` | `.btn-aura-ghost` |

---

## 🔡 4. Tipografia

- **Font Family:** `Plus Jakarta Sans`, sans-serif (Aplicada globalmente)
- **Headlines:** `font-bold`, `tracking-tight`, `leading-tight`
- **Body:** `font-medium`, `text-sm` ou `text-base`

---

## 🎭 5. Biblioteca de Ícones (Material Symbols Outlined)

Use o atributo `data-icon` ou a classe correspondente. Configuração: `FILL: 0` (padrão) ou `FILL: 1` (ativo).

### Emoções & Humor (`.text-primary`)
- `light_mode` (Radiante)
- `waves` (Calmo)
- `visibility` (Reflexivo)
- `bolt` (Ansioso)
- `brush` (Criativo)
- `bedtime` (Descansado)
- `cloud` (Melancólico)

### Produtividade & GTD (`.text-secondary`)
- `spa` (Ícone da Marca / Sanctuary)
- `calendar_month` (Calendário)
- `checklist` (Tarefas)
- `ads_click` (Metas/Target)
- `hourglass_empty` (Aguardando)
- `history_edu` (Notas)
- `push_pin` (Fixado)
- `trending_up` (Progresso)

### Saúde & Ciclo (`.text-tertiary`)
- `favorite` (Coração/Vitalidade)
- `opacity` (Hidratação)
- `local_florist` (Ciclo Menstrual)
- `medication` (Medicação)
- `battery_charging_full` (Energia)
- `hotel` (Sono)
- `device_thermostat` (Temperatura)

---

## 🏗️ 6. Estrutura de Layout

1.  **Header Sanctuary:** Fixo no topo, `h-16`, `backdrop-blur-xl`, título gradiente.
2.  **Ambient background:** Fundo `#ecfcff` com scrollbar personalizada cor `#8abac1`.
3.  **Bottom Nav:** Barra inferior com 5 slots, ícones centralizados, efeito de vidro.
4.  **Bento Grid:** Layout de cards em grid flexível para dashboards de Metas e Insights.
