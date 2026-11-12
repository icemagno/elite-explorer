@echo off
chcp 65001 >nul
title Commander Scan Standalone Server

set "JAR_PATH=%~dp0target\cmdrscan-server-1.0.0.jar"

if not exist "%JAR_PATH%" (
    echo [INFO] Compilando cmdrscan-server com Maven...
    pushd "%~dp0"
    call mvn clean package -DskipTests
    popd
)

if not exist "%JAR_PATH%" (
    echo [ERRO] Falha ao compilar cmdrscan-server-1.0.0.jar.
    pause
    exit /b 1
)

echo ==============================================================================
echo   COMMANDER SCAN STANDALONE SERVER
echo   Servidor de Monitoramento Global EDDN 24/7 (Porta 8081)
echo   Acesse no navegador: http://localhost:8081
echo ==============================================================================
echo.

java -jar "%JAR_PATH%"
