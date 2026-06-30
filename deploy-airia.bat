@echo off
set VPS_USER=root
set VPS_IP=195.35.17.102
set PROJECT_DIR=/opt/airia/app
set LOCAL_APK=apps\mobile\airia.apk
set PUBLIC_APK=apps\web\public\airia.apk

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  D.U.M.M.Y. OS  ^|  DEPLOY AUTOMATIZADO
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo [1/4] Verificando APK local...
if not exist "%LOCAL_APK%" (
    echo AVISO: APK nao encontrado em %LOCAL_APK%
    echo Por favor, coloque o seu APK gerado na pasta apps\mobile\ com o nome airia.apk
    pause
) else (
    echo [2/4] Sincronizando APK com Web...
    copy "%LOCAL_APK%" "%PUBLIC_APK%" /Y
)

echo [3/4] Sincronizando com GitHub...
git add .
git commit -m "feat(deploy): atualizando apk e paridade web/mobile"
git push origin feat/navigation-planner-ui-backend

echo [4/4] Disparando build na VPS (SSH)...
ssh %VPS_USER%@%VPS_IP% "cd %PROJECT_DIR% && git pull origin feat/navigation-planner-ui-backend && ./deploy/airia/deploy.sh"

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  DEPLOy CONCLUIDO! Airia esta no ar.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pause