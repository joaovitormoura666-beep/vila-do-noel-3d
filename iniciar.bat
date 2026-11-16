@echo off
setlocal
title Vila do Noel Live
cd /d "%~dp0"

echo.
echo  ==============================================
echo     Vila do Noel Live  -  MVP 1.0
echo  ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto sem_node

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 goto node_antigo

if exist "node_modules\.package-lock.json" goto iniciar

echo  Primeira vez neste computador: instalando os componentes do jogo.
echo  Isso leva alguns minutos e precisa de internet. Aguarde...
echo.
call npm install
if errorlevel 1 goto erro_instalar
echo.

:iniciar
echo  Preparando o jogo. O painel de controle abre sozinho no
echo  navegador em alguns segundos. Nele, clique em
echo  "Abrir a tela do jogo".
echo.
echo  Deixe esta janela aberta enquanto estiver usando o jogo.
echo  Para encerrar, feche esta janela.
echo.
set VILA_ABRIR=1
call npm start
echo.
echo  O jogo foi encerrado.
echo.
pause
exit /b 0

:sem_node
echo  [!] Falta instalar o Node.js neste computador.
echo.
echo      1. Abra https://nodejs.org e baixe o instalador LTS
echo      2. Instale aceitando tudo o que o instalador sugerir
echo      3. Feche esta janela e abra o iniciar.bat de novo
echo.
pause
exit /b 1

:node_antigo
echo  [!] O Node.js deste computador precisa ser atualizado.
echo.
echo      1. Abra https://nodejs.org e baixe o instalador LTS
echo      2. Instale por cima do que existe hoje
echo      3. Feche esta janela e abra o iniciar.bat de novo
echo.
pause
exit /b 1

:erro_instalar
echo.
echo  [!] Algo deu errado ao instalar os componentes.
echo      Confira a internet e abra o iniciar.bat de novo.
echo      Se continuar, veja "Problemas comuns" no arquivo README.md.
echo.
pause
exit /b 1
