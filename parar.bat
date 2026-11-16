@echo off
rem ===========================================================================
rem  Vila do Noel Live - encerra o jogo que o iniciar.bat abriu.
rem  So encerra a Vila do Noel (confere antes); outro programa na porta fica.
rem  Sem acentos de proposito: o cmd do Windows estraga letras acentuadas.
rem ===========================================================================
setlocal
chcp 65001 >nul 2>nul
title Vila do Noel Live - encerrar
cd /d "%~dp0"
echo.
where node >nul 2>nul
if errorlevel 1 goto sem_node
node tools\windows.cjs parar 3000
node tools\windows.cjs parar 3100 >nul 2>nul
echo.
pause
exit /b 0

:sem_node
echo  O Node.js nao esta instalado, entao o jogo nao pode estar aberto.
echo.
pause
exit /b 0
