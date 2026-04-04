# 🗂️ Inventário Completo de Elementos UI — Aura App (v5)

Este documento centraliza todos os botões, ícones, inputs e elementos visuais necessários para a construção da biblioteca de design unificada.

---

## 🔘 1. Sistema de Botões (AuraButtonV2)

Todos os botões seguem o formato **Full Pill** (arredondamento total) e usam `Plus Jakarta Sans`.

| Tipo | Variante | Uso | Estados |
| :--- | :--- | :--- | :--- |
| **Ação Principal** | `primary` | Fluxos de conclusão, Check-in, Salvar. | Hover (Glow), Active (Scale 0.95), Loading (Spinner). |
| **Vidro Suave** | `glass` | Ações secundárias, abas inativas, configurações. | Backdrop blur + translucidez. |
| **Linha/Outline** | `outline` | Ações de cancelamento, botões de dia na timeline. | Borda delicada 1.5px. |
| **Invisível** | `ghost` | Links, fechar (X), botões de ajuda. | Apenas texto ou ícone sem fundo. |
| **FAB (Flutuante)**| `primary` | Adicionar novo bloco/meta. Fixo no canto inferior. | Sombra profunda, ícone + centralizado. |
| **Ícone Único** | `glass`/`outline`| Settings, Microfone, Pomodoro, Voltar. | Quadrado arredondado (12px) ou Circular. |

---

## 🎭 2. Biblioteca Global de Ícones

O app usa uma mistura de **Material Symbols Outlined** e **Lucide React**.

### 🌿 Identidade & Navegação (Barra Inferior)
- `spa` / `leaf`: Ícone principal (Verdant Sanctuary).
- `home` / `grid_view`: Início.
- `calendar_month` / `event`: Planner.
- `bolt` / `auto_awesome`: Aura IA (Glow effect).
- `history_edu` / `book`: Diário.
- `ads_click` / `target`: Metas & Organização.

### 😊 Emoções (Check-in Grid)
- `light_mode`: Radiante (Amarelo).
- `waves`: Calmo (Teal).
- `visibility`: Reflexivo (Roxo).
- `bolt`: Ansioso (Laranja).
- `brush`: Criativo (Violeta).
- `bedtime`: Descansado (Verde).
- `cloud`: Melancólico (Azul).
- `sentiment_very_satisfied`: Alegre.

### ⚙️ Utilitários & Ações
- `settings`: Configurações.
- `mic`: Entrada de Áudio.
- `add` / `plus`: Criar novo.
- `trash`: Excluir.
- `arrow_back` / `chevron_left`: Voltar.
- `arrow_forward` / `arrow_right`: Enviar/Avançar.
- `schedule` / `clock`: Pomodoro / Horário.
- `sync` / `refresh`: Regenerar IA.
- `sparkles`: Sugestão IA.
- `check_circle`: Concluído.
- `circle`: Pendente.

---

## ⌨️ 3. Campos de Entrada (Inputs)

| Tipo | Estilo | Detalhes |
| :--- | :--- | :--- |
| **Texto/Busca** | Glass Input | `h-52`, `bg-white/40`, bordas suaves, ícone à esquerda. |
| **Área de Texto** | Glass Area | Expansível, usado no Diário e Notas de Metas. |
| **Seletor de Hora** | Pill Input | Formato `HH:MM`, integrado no Planner. |
| **Numérico** | Small Pill | Usado para "A cada X dias" (Recorrência). |
| **Toggle (Switch)** | Pill Toggle | Rosa/Verde, animação de deslize suave. |
| **Checkbox** | Custom Circle | Círculo que preenche com check-mark ao clicar. |

---

## 🎚️ 4. Sliders & Escalas (Range)

- **Aura Slider**: Track fino com preenchimento em gradiente (Verde → Rosa).
- **Thumb**: Círculo branco com glow e borda sutil.
- **Uso**: Intensidade de humor, energia, sono e sintomas (1 a 5).

---

## 💎 5. Elementos de Feedback & Visual

- **Glass Panels**: Cards principais com `blur(12px)` e borda branca translúcida.
- **Mood Spheres**: Esferas de cor gigantes e desfocadas ao fundo (Fixed).
- **Progress Bars**: Barras finas (`h-4` ou `h-6`) com gradiente.
- **Skeletons**: Divs com brilho pulsante para carregamento IA.
- **Spinners**: Anéis delicados giratórios para estados de processamento.
- **Toasts**: Notificações pequenas no topo com borda lateral colorida.

---

## 📐 6. Medidas Base (Design System)
- **Unidade Base (`--a`)**: `13px`.
- **Borda Card**: `1px solid rgba(255,255,255,0.3)`.
- **Raio Padrão**: `1rem` (16px) a `full` (pill).
- **Sombras**: `0 20px 40px rgba(0, 56, 62, 0.06)` (Leve e etéreo).
