# Aura Design System

Fonte operacional para manter consistência visual no app web.

## Fontes de verdade
- Referência visual: `C:\Users\allin\Projetos\Apps\new-app-fron-zero\apps\web\public\mockup-aura-v2.html`
- Sistema base: `C:\Users\allin\Projetos\Apps\new-app-fron-zero\apps\web\src\styles\aura.css`
- Sistema de componentes Aura v2: `C:\Users\allin\Projetos\Apps\new-app-fron-zero\apps\web\src\styles\aura-v2.css`
- Compatibilidade legada: `C:\Users\allin\Projetos\Apps\new-app-fron-zero\apps\web\src\styles\globals.css` e `C:\Users\allin\Projetos\Apps\new-app-fron-zero\apps\web\src\styles\main.css`

## Regras invioláveis
- Tipografia do produto: `Plus Jakarta Sans`
- Cor primária: coral pastel alaranjado `#F3B08C`
- Botão principal: cor linear/flat, sem gradiente
- Glass em superfícies principais: cards, sheets, headers, pills e inputs
- Cabeçalhos sem emoji decorativo e sem mascote solto
- Não criar estilos inline para botão/card se já existir classe Aura equivalente

## Tokens principais
- `--terracotta`, `--primary`, `--atomic-tangerine`, `--nectarine`: `#F3B08C`
- `--primary-hover`, `--nectarine-10`: `#E39A73`
- `--nectarine-11`: `#B86D4C`
- `--menthe`: `#96C7B3`
- `--lagune`: `#6398A9`
- `--background`: `#fffaf0`

## Botões

### Padrão
- Componente preferencial: `AuraButtonV2`
- Altura mínima:
  - `sm`: 32px
  - `md`: 42px
  - `lg`: 52px
- Texto:
  - `sm`: 10.5px / sem quebra
  - `md`: 12px
  - `lg`: 13px
- Labels longos devem usar ellipsis, nunca vazar do botão

### Variantes
- `primary`: coral flat translúcido, com blur leve e borda branca suave
- `glass`: branco translúcido com blur, texto coral ou neutro
- `outline`: translúcido com contorno coral suave
- `ghost`: transparente, sem competir com CTA

### Proibido
- gradiente em CTA principal
- altura diferente sem motivo funcional real
- fontes diferentes por página
- botão com emoji no label como recurso decorativo

## Cards e superfícies
- Card principal: vidro claro com blur entre 18px e 20px
- Borda: branca suave ou coral muito sutil
- Sombras: difusas e quentes, nunca pesadas
- Radius:
  - padrão: 18px
  - compacto: 14px
  - pill: 999px

## Cabeçalhos
- Usar `aura-page-header`, `aura-page-kicker`, `aura-page-title`, `aura-page-subtitle`
- Não usar títulos decorativos fora da hierarquia
- Não usar avatar grande ou bloco vazio no topo

## Processo de alteração
1. comparar a tela com `mockup-aura-v2.html`
2. ajustar primeiro tokens e classes compartilhadas
3. só depois mexer em exceções de tela
4. se surgir novo padrão recorrente, promover para `aura.css` ou `aura-v2.css`
5. validar com `npm run build --workspace=@app/web`

## Meta de prevenção
Se uma correção visual exigir repetir o mesmo ajuste em 2+ telas, isso não é correção local; é dívida do design system e deve virar regra/classe/token compartilhado.
