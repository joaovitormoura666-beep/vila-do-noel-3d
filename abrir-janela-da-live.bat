@echo off
rem ===========================================================================
rem  Vila do Noel Live - abre a tela do jogo numa janela propria para o
rem  TikTok LIVE Studio capturar (captura de janela):
rem    - sem barra de endereco, no formato em pe (9:16), 540x960;
rem    - o som sai sem precisar clicar;
rem    - continua animando mesmo com outra janela na frente.
rem  Usa o Edge (que ja vem no Windows) ou o Chrome, num perfil separado.
rem  Antes, o iniciar.bat precisa estar aberto.
rem  Para uma janela maior (1080x1920, so em telas grandes), rode:
rem      abrir-janela-da-live.bat 1080
rem  Sem acentos de proposito: o cmd do Windows estraga letras acentuadas.
rem ===========================================================================
setlocal
chcp 65001 >nul 2>nul
cd /d "%~dp0"
if not defined PORT set PORT=3000
where node >nul 2>nul
if errorlevel 1 goto sem_node
node tools\windows.cjs abrir-janela %PORT% %1
if errorlevel 1 goto falhou
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
