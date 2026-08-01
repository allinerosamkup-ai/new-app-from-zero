---
name: airia-checkin-flow
description: Corrija e simplifique o check-in de humor e energia da Airia quando a leitura estiver imprecisa, o contexto estiver fragmentado ou o registro rapido perder dados necessarios para correlacoes.
---

# Check-in Integrado

O check-in captura humor e energia atuais com contexto suficiente, em uma sessao progressiva. A mesma escrita deve servir tela, Diario e Comando Central.

1. Compare entradas, escalas, mapeamento de emocao, contexto e endpoint de cada superficie.
2. Mantenha humor e energia como sinais obrigatorios; apresente sono, corpo, ciclo, estresse e nota como adicoes rapidas na mesma tela, sem paginas fragmentadas.
3. Derive o resultado de valores atuais e contexto informado; se faltarem dados, comunique limite em vez de afirmar certeza.
4. Persista por `record_checkin`/upsert, reflita no dia e use hora local para evitar duplicidade ou leitura de outro dia.
5. Verifique teclado, retorno, edicao e recuperacao apos recarregar no celular.

**Como verificar:** registre humor 3, energia 7 e contexto; o resultado recuperado deve refletir esses mesmos valores e alimentar a proxima sugestao sem criar novo check-in.
