# Rubrica 8/10 e “impressionado”

Aprovar não é ausência de defeito. A barra é o resultado que impressiona quem verifica, com evidência. `8,0` é piso de entrada. Nota alta em entrega morna é falha.

Alinha `AGENTS.md` e o protocolo de iteração com a governança multiagente.

## Pesos

| Dimensão | Peso | 8–10 exige |
|---|---:|---|
| Fidelidade à intenção | 20% | Resolve a necessidade humana, não só o sintoma técnico |
| Funcionamento e dados | 20% | Estados, persistência, erros e efeitos entre telas corretos |
| UI/UX e acessibilidade | 20% | Hierarquia, toque, texto, contraste, vazio, uma mão |
| Segurança e privacidade | 15% | Sem exposição, ação irreversível escondida ou resposta de risco inadequada |
| Qualidade de IA e conteúdo | 15% | Contextual, concreto, localizado, explicável; sem eco de conversa |
| Manutenibilidade | 10% | Próxima mudança fica mais segura |

Ponderada = soma(nota × peso).

## Portões (todos)

1. Ponderada ≥ 8,0
2. Nenhuma dimensão < 7,0
3. Zero bloqueio crítico (segurança, dados, acessibilidade, coerência, regressão)
4. Testes do ticket e testes existentes passam
5. Simulador humano ok nos cenários aplicáveis
6. Dois pontos “impressionado” concretos
7. Coordenador: jornada vizinha e núcleo ativo íntegros

## Impressionado

Dois aspectos específicos que tornam a entrega mais clara, segura, simples ou coerente que o mínimo. Sem esconder risco. Sem elogio genérico.

## PRODUCT FAIL mesmo com testes verdes

- devolve à pessoa uma decisão que a Airia já podia tomar
- ignora contexto disponível
- botão sem ação real ou sucesso simulado
- sugestão sem âncora
- estado diferente entre superfícies
- hipótese vendida como fato
- módulo desligado reaparece

## Auditoria de ação

Reprove se qualquer item for não: verbo executável · objeto específico · âncora real · cabe no estado · “Pronto quando” verificável.
