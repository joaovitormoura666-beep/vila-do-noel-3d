@echo off
rem ===========================================================================
rem  Vila do Noel Live - atalho do Windows (dois cliques para abrir o jogo)
rem
rem  1. confere se o Node.js 20 ou mais novo esta instalado (se nao, explica e
rem     abre a pagina de download);
rem  2. confere se a porta 3000 esta livre (se o jogo ja esta aberto, so abre
rem     o painel; se outro programa usa a porta, oferece a porta 3100);
rem  3. roda "npm install" so quando precisa (primeira vez ou package.json mudou);
rem  4. compila as paginas (jogo 3D, versao classica 2D e painel), liga o
rem     servidor em http://localhost:3000 e abre o painel no navegador.
rem
rem  Sem acentos de proposito: o cmd do Windows estraga letras acentuadas.
rem  O passo a passo completo esta em docs\COMO-RODAR-NA-LIVE.md.
rem ===========================================================================
setlocal
chcp 65001 >nul 2>nul
title Vila do Noel Live
cd /d "%~dp0"
if not defined PORT set PORT=3000

echo.
echo  ==============================================
echo     Vila do Noel Live
echo  ==============================================
echo.

if not exist "package.json" goto sem_pasta
if not exist "tools\windows.cjs" goto sem_pasta

where node >nul 2>nul
if errorlevel 1 goto sem_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 goto node_antigo
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 echo  Aviso: o Node.js deste computador e antigo. Funciona, mas instale o 22 LTS quando puder.
where npm >nul 2>nul
if errorlevel 1 goto sem_node

:conferir_porta
node tools\windows.cjs porta %PORT%
if errorlevel 2 goto porta_ocupada
if errorlevel 1 goto ja_aberto

node tools\windows.cjs precisa-instalar
if errorlevel 1 goto iniciar

echo  Instalando os componentes do jogo (primeira vez, ou o projeto foi
echo  atualizado). Isso leva alguns minutos e precisa de internet. Aguarde...
echo.
call npm install --no-audit --no-fund
if errorlevel 1 goto erro_instalar
node tools\windows.cjs marcar-instalado
echo.

:iniciar
echo  Preparando o jogo (leva cerca de um minuto). O painel de controle
echo  abre sozinho no navegador quando estiver pronto.
echo.
echo  No painel: "Abrir a tela do jogo" mostra a Vila do Noel 3D.
echo  Endereco para o OBS: http://localhost:%PORT%/?obs
echo.
echo  Deixe esta janela aberta enquanto estiver usando o jogo.
echo  Para encerrar: feche esta janela (ou abra o parar.bat).
echo.
set VILA_ABRIR=1
call npm start
echo.
echo  O jogo foi encerrado.
echo  Se apareceu alguma mensagem com [erro] acima, ela explica o motivo.
echo  Para abrir de novo, de dois cliques no iniciar.bat.
echo.
pause
exit /b 0

:ja_aberto
echo  A Vila do Noel ja esta aberta (em outra janela preta como esta).
echo  Vou abrir o painel no navegador.
echo.
echo  Para fechar o jogo: feche a outra janela, ou abra o parar.bat.
echo.
start "" "http://localhost:%PORT%/painel.html"
pause
exit /b 0

:porta_ocupada
echo  [!] Outro programa deste computador esta usando a porta %PORT%,
echo      que o jogo usa. Pode ser outro servidor que ficou aberto.
echo.
echo      Jeitos de resolver:
echo        - feche o outro programa e abra o iniciar.bat de novo; ou
echo        - reinicie o computador; ou
echo        - use outra porta agora (o endereco do OBS muda para a porta nova).
echo.
if "%PORT%"=="3100" goto porta_ocupada_fim
choice /c SN /n /m "     Usar a porta 3100 agora? Aperte S (sim) ou N (nao): "
if errorlevel 2 goto porta_ocupada_fim
set PORT=3100
echo.
goto conferir_porta
:porta_ocupada_fim
echo.
pause
exit /b 1

:sem_pasta
echo  [!] Nao achei os arquivos do jogo ao lado deste iniciar.bat.
echo.
echo      Se voce abriu o .zip com dois cliques, primeiro extraia tudo:
echo      clique com o botao direito no .zip, escolha "Extrair tudo",
echo      e abra o iniciar.bat de dentro da pasta extraida.
echo.
pause
exit /b 1

:sem_node
echo  [!] Falta instalar o Node.js neste computador (e de graca).
echo.
echo      1. Vou abrir o site https://nodejs.org no navegador
echo      2. Baixe a versao "LTS" (a recomendada, 22 ou mais nova)
echo      3. Instale aceitando tudo o que o instalador sugerir
echo      4. Feche esta janela e abra o iniciar.bat de novo
echo.
start "" "https://nodejs.org/"
pause
exit /b 1

:node_antigo
echo  [!] O Node.js deste computador e antigo demais (precisa do 20 ou mais novo).
echo.
echo      1. Vou abrir o site https://nodejs.org no navegador
echo      2. Baixe a versao "LTS" (22 ou mais nova) e instale por cima
echo      3. Feche esta janela e abra o iniciar.bat de novo
echo.
start "" "https://nodejs.org/"
pause
exit /b 1

:erro_instalar
echo.
echo  [!] Algo deu errado ao instalar os componentes.
echo      Confira a internet e abra o iniciar.bat de novo.
echo      Se continuar: apague a pasta node_modules e tente outra vez.
echo      Mais ajuda em docs\COMO-RODAR-NA-LIVE.md (Problemas comuns).
echo.
pause
exit /b 1
