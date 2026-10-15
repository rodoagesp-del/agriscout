// =========================================================
// MAIN - Inicialización de la app y Service Worker
// =========================================================

// --- PWA SERVICE WORKER REGISTRATION (MODO OFFLINE) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado para modo offline.', reg))
            .catch(err => console.error('Error en Service Worker:', err));
    });
}

window.onload = () => {
    loadData();
    initMap();
};