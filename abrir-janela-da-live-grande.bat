@echo off
rem ===========================================================================
rem  Vila do Noel Live - igual ao abrir-janela-da-live.bat, mas com a janela
rem  grande (1080x1920, mais nitida). So cabe em telas grandes (altura de
rem  pelo menos 2000 pontos, como monitores 4K ou de pe). Em telas comuns, use
rem  o abrir-janela-da-live.bat (540x960).
rem  Sem acentos de proposito: o cmd do Windows estraga letras acentuadas.
rem ===========================================================================
setlocal
cd /d "%~dp0"
call "%~dp0abrir-janela-da-live.bat" 1080
