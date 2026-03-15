# Documento 4 — Mapa de Telas e Interface (Wireframing Textual)

## 1. Visão Geral da Interface

A interface deve priorizar uma UX "Glassmorphism", calma, suave e extremamente responsiva. Inspirada na limpeza do Structured e na abordagem humana do Justly. Sem "botões gritantes" ou excesso de informações.

**Paleta de Cores Recomendada (Base):**

- **Fundo:** Tons pastéis muito claros (Off-white, Lavanda claro, Verde menta diluído) ou Dark Mode profundo (Azul noite, Cinza chumbo).
- **Acentos (Highlights):** Utilizado nas categorias de blocos do planner ou no botão principal de IA (Laranja suave, Turquesa).
- **Tipografia:** Sem serifa, geométrica e amigável (ex: Inter, Poppins, ou SF Pro).

## 2. Mapa Principal de Navegação (Bottom Tab Bar)

O app terá um número muito reduzido de guias principais:

1. **Hoje (Home/Planner):** Tela central onde 90% da interação acontece.
2. **Diário (Journal):** Central de conversas passadas e botão de nova sessão.
3. **Padrões (Insights):** Tela de relatório semanal e gatilhos de energia.
4. **Configurações:** Conta, Wearables futuros, Tema, LGPD.

## 3. Detalhamento Tela a Tela

### 3.1 Tela Home / Hoje (A Tela de Entrada)

**Objetivo:** Ser o "painel de controle" de baixa fricção da pessoa antes de iniciar o dia.
**Componentes Top-Down:**

- **Header (Saudação):** "Bom dia, Nome."
- **Card Principal "Estado de Hoje":**
  - *Se não fez check-in:* Botão grande "Como você amanheceu? → Fazer Check-in rápido".
  - *Se fez check-in:* Mostra o Rótulo calculado pela IA (ex: "Dia Sensível 🌧️") e uma frase curta de sugestão (ex: "Priorize tarefas curtas e muito descanso após o almoço.").
- **Container Planner (Timeline):**
  - Uma linha vertical contínua conectando as horas do lado esquerdo.
  - Blocos (Cards) empilháveis representando as tarefas.
  - **Interação:** Drag and drop para reordenar, Swipe para a direita no bloco para marcar como concluído, Swipe leve para esquerda para editar.
- **Floating Action Button (FAB):** Um botão central (+) de IA. Ao clicar, a pessoa tem duas opções: "Nova Tarefa" ou "Desabafar (Diário)".

### 3.2 Tela de Check-in Rápido ("Estado de Hoje")

**Objetivo:** Captar 4 ou 5 sinais subjetivos com zero digitação obrigatória em 15 segundos.
**Componentes Top-Down:**

- **Título:** "Check-in Matinal"
- **Deslize 1 (Humor):** Carinhas de 😊 a ☁️ (ou um slider suave de 1 a 5).
- **Deslize 2 (Bateria/Energia Psíquica):** Ícones de pilhas visuais (10% a 100%).
- **Deslize 3 (Mental):** Nível de "névoa mental" / clareza.
- **Botão Opcional:** "Quer escrever algo a mais?" (Abre textarea).
- **Botão Fixo Base:** "Salvar Estado".

### 3.3 Tela Diário Guiado (O Chat Coach)

**Objetivo:** Uma sessão terapêutico-comportamental para aliviar carga ou ajustar rota.
**Componentes Top-Down:**

- **Header contextual:** Indica o modo que a IA assumiu hoje (ligado ao check-in).
- **Feed de Chat Visual:** Estilo WhatsApp, mas mais arejado e calmo.
- **Input Bottom:**
  - Barra de texto.
  - Ícone de Microfone de destaque (para envio de áudio direto, sem forçar teclado).
- **Encerramento:** Botão fixo superior "Encerrar Sessão". Ao clicar, transita para a tela de Resultado da Sessão.

### 3.4 Tela de Resumo de Diário

**Objetivo:** Dar retorno imediato do que o app absorveu após o chat, para que o usuário não sinta que jogou palavras no vácuo.
**Componentes:**

- **Grande Card Superior:** Título (ex: "A carga de hoje foi sobre ansiedade de entregas").
- **Seção "Emoções Detectadas":** Tags ou pilulas coloridas (Pressionada, Acelerada).
- **Seção "O que isso significa":** 2 parágrafos curtos resumindo a conversa em 3ª pessoa ("Você notou que...").
- **Call-to-Action:** Botão "Ajustar o Planner com base nisso".

### 3.5 Tela de Padrões (Dashboard Semanal)

**Objetivo:** Entregar a promessa do "Sincronizador Biológico" olhando para o passado recente.
**Componentes:**

- **Seletor de Tempo:** Semana atual / Mês.
- **Gráfico de Linha / Onda:** Cruzamento de energia e humor através dos dias (Linha sinuosa suave).
- **Seção "Seus Padrões":** Lista de cards gerados pelo job semanal da IA.
  - Ex: *Gatilho Identificado:* Toda vez que a energia cai na terça, a quarta-feira é improdutiva se você tenta forçar.
- **Seção "Zonas de Foco":** Histograma mostrando qual momento do dia essa usuária específica costuma limpar mais tarefas.

### 3.6 Fluxo de Criação de Tarefa/Bloco

- Tela que sobrepõe a Home (Bottom Sheet / Modal).
- **Input simples textual:** Usa a linguagem natural. Ex: "Reunião de alinhamento das 14h as 15h".
- Se a usuária tem muita energia, sugere categorizar como "Bloco Foco Profundo". Se tem pouca, sugere "Bloco Leve/Administrativo".

## 4. Estados e Feedbacks Vazios (Empty States)

**Primeiro dia sem dados na Home:** "Bem-vinda ao seu novo ritmo. Para seu planner se moldar a você, vamos fazer o primeiro check-in de energia?"
**Diário sem sessões:** Ilustração relaxante, "O Diário é o seu espaço seguro. A IA não julga, apenas escuta e ajusta o relógio interno."
**Padrões vazios:** "A mágica acontece com o tempo. Preencha seus check-ins por 5 dias para ver seu ciclo se desenhar aqui."
