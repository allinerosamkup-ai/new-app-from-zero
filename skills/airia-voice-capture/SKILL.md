---
name: airia-voice-capture
description: Corrija captura e transcricao por microfone da Airia quando houver frases repetidas, trechos perdidos, envio duplicado, falha de permissao ou comportamento divergente entre Diario, Check-in e Comando Central.
---

# Voz da Airia

Trate a transcricao como uma sessao: resultados provisórios substituem o rascunho; resultados finais entram uma unica vez; parar, reiniciar ou enviar nunca reaproveita o mesmo trecho.

1. Mapeie todos os consumidores da Web Speech API e o estado compartilhado.
2. Reproduza com ao menos dois resultados provisórios e dois finais; verifique que cada frase final aparece uma vez.
3. Preserve acessibilidade, permissao, cancelamento, erro visivel e envio manual.
4. Cubra a regressao com teste de unidade do acumulador e, quando possivel, fluxo no navegador.

**Como verificar:** fale uma frase com pausa e uma correcao; o campo final deve conter cada trecho uma vez, sem texto provisório duplicado.
