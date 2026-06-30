@echo off
set VPS_USER=root
set VPS_IP=195.35.17.102
set REMOTE_PATH=/opt/airia/app/apps/web/public/airia.apk

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  D.U.M.M.Y. OS  ^|  ASSOPRAR APK PARA VPS
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo [1/3] Iniciando build no EAS...
echo (Aguardando resposta do servidor Expo...)
for /f "tokens=*" %%i in ('npx eas-cli build -p android --profile preview --non-interactive --json') do set BUILD_JSON=%%i

echo [2/3] Monitorando build...
echo O D.U.M.M.Y. OS esta acompanhando seu build na nuvem.
echo Assim que o APK for gerado, ele sera enviado para https://airia.pro/airia.apk

:: Nota: O comando abaixo assume que voce ja esta logado no EAS.
:: Se nao estiver, ele vai te pedir o login apenas uma vez.
npx eas-cli build -p android --profile preview --non-interactive

echo [3/3] Capturando binario e enviando para VPS...
:: O EAS CLI as vezes demora para liberar o link direto, o comando abaixo
:: garante que o ultimo build bem sucedido seja enviado para a VPS.
for /f "tokens=*" %%a in ('npx eas-cli build:list --platform android --status finished --limit 1 --json ^| npx json-parse-help buildUrl') do set APK_URL=%%a

echo Link detectado: %APK_URL%
echo Enviando para a VPS...

ssh %VPS_USER%@%VPS_IP% "wget -O %REMOTE_PATH% %APK_URL% && chmod 644 %REMOTE_PATH%"

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  APK ASSOPRADO COM SUCESSO!
echo  Disponivel em: https://airia.pro/airia.apk
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pause