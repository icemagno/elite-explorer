// splash.js - Tela de abertura do Elite Explorer Copilot

(function () {
    const splashEl = document.getElementById('app-splash-screen');
    if (!splashEl) return;

    const urlParams = new URLSearchParams(window.location.search);
    // Pula a splash screen quando o navegador entra direto em ?view=surface (transição automática de voo)
    if (urlParams.get('view') === 'surface' || urlParams.get('skipSplash') === '1') {
        splashEl.style.display = 'none';
        return;
    }

    const cmdrEl = document.getElementById('splashCommanderName');
    const statusEl = document.getElementById('splashStatusText');
    let dismissed = false;

    function dismissSplash() {
        if (dismissed) return;
        dismissed = true;
        splashEl.classList.add('splash-fade-out');
        setTimeout(() => {
            splashEl.style.display = 'none';
        }, 520);
    }

    // Carrega o nome do comandante diretamente da configuração do servidor (/api/app/identity)
    fetch('/api/app/identity')
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
            if (data && data.commanderName && cmdrEl) {
                cmdrEl.textContent = `CMDR ${data.commanderName.toUpperCase()}`;
            }
            if (statusEl) {
                statusEl.textContent = 'SISTEMAS PRONTOS • SINCRONIZANDO TELEMETRIA';
            }
        })
        .catch(() => {
            if (cmdrEl && cmdrEl.textContent === 'CMDR ...') {
                cmdrEl.textContent = 'CMDR EXPLORER';
            }
        });

    splashEl.addEventListener('click', dismissSplash);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
            dismissSplash();
        }
    }, { once: true });

    // Encerra automaticamente após a animação de abertura
    setTimeout(dismissSplash, 3600);
})();
