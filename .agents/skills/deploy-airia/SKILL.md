# Deploy Airia VPS/PWA/APK

Use esta skill quando Alline pedir para "jogar para VPS", "atualizar PWA", "atualizar APK" ou publicar a Airia.

## Caminho Correto

1. Validar localmente:
   - `npm run build --workspace=@app/web`
   - `npm run build --workspace=@app/backend`
   - `npm run test --workspace=@app/backend`
2. Staging/commit:
   - Stage apenas arquivos de codigo/produto.
   - Nao stagear `.tmp/*`, `share.html`, `share-browser.html`, `AGENTS.md` zerado ou artefatos soltos antigos.
   - Commitar e dar push em `feat/navigation-planner-ui-backend`.
3. VPS/PWA:
   - Na VPS, o pull correto e:
     `ssh root@195.35.17.102 "cd /opt/airia/app && git pull origin feat/navigation-planner-ui-backend"`
   - O script remoto nao esta executavel. Rodar via `sh`:
     `ssh root@195.35.17.102 "cd /opt/airia/app && sh ./deploy/airia/deploy.sh"`
   - Validar containers:
     `ssh root@195.35.17.102 "docker ps --filter name=airia"`
4. APK local (caminho preferido nesta maquina):
   - Antes de build novo, incrementar `apps/mobile/app.json` em `expo.version` e `android.versionCode`.
   - Se `apps/mobile/android` ja existir, atualizar tambem `apps/mobile/android/app/build.gradle` em `versionName` e `versionCode`.
   - Garantir Java/JDK disponivel. Se `java` nao existir, instalar/ativar Temurin 17.
   - Build local correto:
     `cd apps/mobile/android && .\gradlew.bat assembleRelease`
   - Copiar o APK gerado de `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` para:
     - `apps/web/public/airia.apk`
     - `apps/mobile/airia.apk`
   - Commitar o APK publico atualizado.
   - Push na mesma branch.
   - Rodar novamente `sh ./deploy/airia/deploy.sh` para o container web embutir o APK novo.
5. Validacao final:
   - `https://airia.pro/home`
   - `https://airia.pro/api/health`
   - `https://airia.pro/manifest.webmanifest`
   - `https://airia.pro/airia.apk`

## Observacoes

- `deploy-airia.bat` tem branch correta hoje, mas usa o script remoto como executavel; se falhar com `Permission denied`, usar `sh ./deploy/airia/deploy.sh`.
- Nao usar Expo/EAS como primeira opcao neste projeto. A VPS/APK da Airia, neste ambiente, segue caminho local Android/Gradle.
- `assoprar-apk.bat` dispara build EAS duplicado; evitar salvo pedido explicito.
- O APK publico vem do build do frontend: se `apps/web/public/airia.apk` mudar, precisa redeploy do `airia_web`.
