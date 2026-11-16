@echo off
rem ===========================================================================
rem  Vila do Noel Live - abre a tela do jogo numa janela propria para o
rem  TikTok LIVE Studio capturar (captura de janela):
rem    - sem barra de endereco, no formato em pe (9:16), 540x960;
rem    - o som sai sem precisar clicar;
rem    - continua animando mesmo com outra janela na frente.
rem  Usa o Edge (que ja vem no Windows) ou o Chrome, num perfil separado.
rem  Antes, o iniciar.bat precisa estar aberto (na porta 3000 ou 3100: este
rem  atalho acha sozinho).
rem  Para uma janela maior (1080x1920, so em telas grandes), use o
rem  abrir-janela-da-live-grande.bat.
rem  Sem acentos de proposito: o cmd do Windows estraga letras acentuadas.
rem ===========================================================================
setlocal
chcp 65001 >nul 2>nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto sem_node
node tools\windows.cjs abrir-janela %1
if errorlevel 1 goto falhou
rem  deixa a mensagem visivel por alguns segundos (avisos de tela em dobro)
timeout /t 6 >nul 2>nul
exit /b 0

:falhou
echo.
pause
exit /b 1

:sem_node
echo  O Node.js nao esta instalado. Veja docs\COMO-RODAR-NA-LIVE.md.
echo.
pause
exit /b 1
