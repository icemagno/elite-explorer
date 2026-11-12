@echo off
chcp 65001 >nul
title Elite Explorer Copilot

:: ==============================================================================
:: CONFIGURACAO DO COMANDANTE - EDITE APENAS AS DUAS LINHAS ABAIXO E SALVE
:: ------------------------------------------------------------------------------
:: 1) CMDR_NAME    = Seu nome de Comandante exatamente como aparece no jogo/EDSM
:: 2) EDSM_API_KEY = Sua chave de API do EDSM (opcional - deixe vazio se nao usar)
::                   (Obtida em: https://www.edsm.net/en/settings/api)
:: ==============================================================================
set "CMDR_NAME="
set "EDSM_API_KEY="
:: ==============================================================================

set "JAR_PATH=%~dp0elite-explorer-1.0.0.jar"
if not exist "%JAR_PATH%" set "JAR_PATH=%~dp0target\elite-explorer-1.0.0.jar"

if not exist "%JAR_PATH%" (
    if exist "%~dp0pom.xml" (
        where mvn >nul 2>nul
        if errorlevel 1 (
            echo [ERRO] Arquivo elite-explorer-1.0.0.jar nao encontrado e Maven ^(mvn^) nao esta no PATH.
            echo Instale o Maven ou coloque o .jar pre-compilado na pasta do projeto.
            pause
            exit /b 1
        )
        echo [INFO] Arquivo .jar nao encontrado. Compilando o projeto com Maven...
        pushd "%~dp0"
        call mvn package -DskipTests
        if errorlevel 1 (
            popd
            echo.
            echo [ERRO] Falha ao compilar o projeto.
            pause
            exit /b 1
        )
        popd
        set "JAR_PATH=%~dp0target\elite-explorer-1.0.0.jar"
    )
)

if not exist "%JAR_PATH%" (
    echo [ERRO] Arquivo elite-explorer-1.0.0.jar nao encontrado.
    pause
    exit /b 1
)

echo ==============================================================================
echo   ELITE EXPLORER COPILOT
echo   Acesse no navegador: http://localhost:8080
echo ==============================================================================
if "%CMDR_NAME%"=="" (
    echo   Comandante : [Lendo automaticamente do Journal do jogo]
) else (
    echo   Comandante : CMDR %CMDR_NAME%
)
if "%EDSM_API_KEY%"=="" (
    echo   EDSM Sync  : Sem chave de API configurada ^(somente leitura local^)
) else (
    echo   EDSM Sync  : Chave de API informada
)
echo ==============================================================================
echo.

java -jar "%JAR_PATH%" --edsm.commander.name="%CMDR_NAME%" --edsm.api.key="%EDSM_API_KEY%"

if errorlevel 1 (
    echo.
    echo [ERRO] O servidor foi encerrado com erro. Verifique se o Java 22 esta instalado.
    pause
)
