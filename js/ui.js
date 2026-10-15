// =========================================================
// UI - Navegación de pestañas y notificaciones
// =========================================================

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('text-emerald-600');
        b.classList.add('text-slate-500');
    });
    btnElement.classList.remove('text-slate-500');
    btnElement.classList.add('text-emerald-600');

    if (tabId === 'zonas' && map) {
        setTimeout(() => {
            map.invalidateSize();
            if (drawnItems.getLayers().length > 0) map.fitBounds(drawnItems.getBounds(), { padding: [20, 20] });
        }, 100);
    }
    if (tabId === 'config') { renderTreeTypes(); renderCategories(); }
    if (tabId === 'report') { updateReportZoneSelect(); refreshCurrentReport(); }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('opacity-0');
    setTimeout(() => toast.classList.add('opacity-0'), 3000);
}