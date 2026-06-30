# Android Planner State Widget Design

## Goal

Criar um widget Android real para o APK mobile da Airia, mostrando o estado de hoje e os próximos blocos do planner em uma única superfície de tela inicial.

## Product Shape

O widget se chama `Hoje na Airia`. Ele deve ser pequeno o bastante para caber bem em `4x2`, mas útil sem abrir o app.

Conteúdo:
- topo com estado atual do dia, por exemplo `Estável`, `Sensível` ou `Sem check-in`;
- linha curta de energia/humor quando houver dados;
- até três próximos blocos do planner de hoje, com horário e título;
- estado vazio gentil quando não houver check-in ou planner carregado;
- toque no widget abre o app na Home/Planner.

## Technical Approach

O app mobile está em Expo gerenciado e não possui pasta `android/`. Para evitar prebuild permanente agora, a implementação deve usar um config plugin em `apps/mobile/plugins/` que injeta os arquivos nativos Android durante o prebuild/EAS.

O widget Android precisa de:
- `AppWidgetProvider` em Kotlin;
- layout XML em `res/layout`;
- metadata `appwidget-provider` em `res/xml`;
- registro no `AndroidManifest.xml`;
- dados salvos em `SharedPreferences`.

O React Native publica um resumo simples em `AsyncStorage`. A parte nativa lê esse resumo e renderiza `RemoteViews`. Neste primeiro corte, os dados são atualizados quando o app abre e carrega Home/Planner. Atualização em background fica para uma etapa posterior, junto de push real.

## Data Contract

Chave local:

`airia_widget_today`

Formato JSON:

```json
{
  "stateLabel": "Estável",
  "stateType": "stable",
  "moodScore": 7,
  "energyScore": 6,
  "updatedAt": "2026-04-17T12:00:00.000Z",
  "planner": [
    { "time": "09:00", "title": "Revisar agenda" }
  ]
}
```

## Constraints

- APK Android apenas nesta entrega.
- Não implementar widget iOS agora.
- Não adicionar recurso terapêutico novo.
- Não mexer no backend nem no web app.
- Não criar pasta `android/` manualmente enquanto o config plugin resolver.

## Validation

- `tsc -p apps/mobile/tsconfig.json --noEmit`
- `npx expo config --type introspect` dentro de `apps/mobile`
- Se o ambiente permitir, `npx expo prebuild --platform android --no-install` para confirmar geração dos arquivos nativos.
