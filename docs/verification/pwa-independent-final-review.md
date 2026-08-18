Nota global: 9,2/10  
Veredito: aprovada

Evidência objetiva dos três bloqueios:
1) Ponte de inspeção com postMessage no Vite
- apps/web/vite.config.ts agora só registra react(), releaseMetadataPlugin() e VitePWA(...); não há plugin/bridge de inspeção nem uso de postMessage.
- Validação de build: produção sem html2canvas, previewbridge-component-data e screenshotResult; SW desativado no servidor de desenvolvimento. Isso elimina a ponte de inspeção observada anteriormente.

2) Home podia mostrar recomendações concorrentes
- Precedência explícita documentada no código: “leitura canônica > nudge contextual > autonomia > ação de momento”.
- Gating da ação principal: showMomentPrimaryAction exige !hasCanonicalDecision && !hasProactiveNudge && visibleAutonomyActions.length === 0.
- Gating da Autonomia no card compacto: visibleActions só aparece quando !usesCanonicalDecision && !hasProactiveNudge.
- Resultado: apenas um “próximo passo” recebe destaque por vez, removendo a concorrência.

3) ‘diagnoses’ em IDs internos mas fora do onboarding ativo
- DIAGNOSIS_CHOICES agora é coletado dentro do passo “traits” (step === "traits"), com toggle de answers.diagnoses; o usuário vê e pode optar responder.
- STORY_STEPS (fluxo ativo) não inclui "diagnoses", e há comentário claro: “‘STORY_STEPS’ é a única sequência apresentada em novos onboardings”; “diagnoses” permanece como vocabulário/rota legada reconhecida pelo renderer.
- Resultado: a informação antes “órfã” do fluxo ativo passou a existir no onboarding (opcional dentro de traits), eliminando o descompasso prático que motivou o bloqueio.

Riscos residuais (máx. 3):
- Passo legado “diagnoses” ainda existe (ID e componente) fora do fluxo ativo; risco de reativação acidental ou deriva entre caminhos. Mitigar com remoção ou feature flag clara e teste de não-renderização no fluxo canônico.
- A precedência na Home depende de múltiplas flags espalhadas; novas fontes de recomendação podem quebrar a exclusividade se não passarem pelo mesmo árbitro. Mitigar centralizando a arbitragem e cobrindo com testes de regressão.
- PWA com registerType: 'prompt' e injectRegister: false pode manter clientes desatualizados se o usuário ignorar o prompt. Garantir que a navegação para release exata cubra casos de migração e monitorar taxa de adoção de versões.
