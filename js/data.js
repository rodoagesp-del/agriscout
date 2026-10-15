// =========================================================
// DATA STATE - Estado global, LocalStorage, Nube y Backups
// =========================================================

const CLOUD_API_URL = 'https://script.google.com/macros/s/AKfycbwV9SCFQRwjDp4t5MigLgXrstAAfcObkJRfsN3CaI6ZYr2XKbwdN-b2dblpwx53kTVf/exec';

let appData = { zones: [], categories: [], evaluations: [], treeTypes: [] };
let map, userMarker, drawnItems = L.featureGroup(), drawingMarkers = L.featureGroup();
let currentDrawingPoints = [], drawingPolygonLine;
let currentLocation = null, currentEvaluation = null;
let currentReportView = 'visual'; // 'visual', 'table' o 'chart'
let chartInstance = null; // Para la gráfica de evolución

// --- INIT & STORAGE ---
function loadData() {
    const saved = localStorage.getItem('agriScoutData');
    if (saved) {
        appData = JSON.parse(saved);
        if (!appData.zones) appData.zones = [];
        if (!appData.categories) appData.categories = [];
        if (!appData.evaluations) appData.evaluations = [];
        if (!appData.treeTypes) appData.treeTypes = [];

        // BACKWARD COMPATIBILITY: Agregar 'labels' (niveles 1 a 4) a items antiguos que no lo tengan
        appData.categories.forEach(cat => {
            cat.items.forEach(item => {
                if (item.type === 'ordinal' && !item.labels) {
                    item.labels = { 1: 'Poca presencia', 2: 'Media presencia', 3: 'Alta presencia', 4: 'Crítico / Extremo' };
                }
            });
        });
    } else {
        appData.categories = [
            { id: 'cat_1', name: 'Plagas', items: [
                {id: 'it_1', name: 'Bicho del cesto', type: 'ordinal', labels: {1: 'Solo 1 individuo', 2: 'Menos de 3 individuos', 3: 'Menos de 5 individuos', 4: 'Más de 6 individuos'}},
                {id: 'it_2', name: 'Trips', type: 'ordinal', labels: {1: 'Bajo', 2: 'Medio', 3: 'Alto', 4: 'Muy Alto'}}
            ]},
            { id: 'cat_2', name: 'Enfermedades', items: [
                {id: 'it_3', name: 'Lasiodiplodia', type: 'ordinal', labels: {1: 'Nivel 1', 2: 'Nivel 2', 3: 'Nivel 3', 4: 'Nivel 4'}},
                {id: 'it_4', name: 'Cladosporium', type: 'ordinal', labels: {1: 'Nivel 1', 2: 'Nivel 2', 3: 'Nivel 3', 4: 'Nivel 4'}}
            ]}
        ];
        saveData();
    }
}

function saveData() {
    localStorage.setItem('agriScoutData', JSON.stringify(appData));
}

// --- RESPALDO Y RECUPERACIÓN (BACKUP) ---
function exportBackup() {
    const dataStr = JSON.stringify(appData);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `AgriScout_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("Copia de seguridad descargada. Puedes guardarla en tu Google Drive.");
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (importedData && importedData.zones && importedData.categories && importedData.evaluations) {
                if (confirm("⚠️ ¿Estás seguro de cargar esta copia? Sobrescribirá TODOS los datos actuales de este dispositivo con los del archivo.")) {
                    appData = importedData;
                    saveData();
                    alert("¡Datos restaurados con éxito! La aplicación se recargará para aplicar los cambios.");
                    location.reload();
                }
            } else {
                alert("❌ El archivo no parece ser una copia de seguridad válida de AgriScout.");
            }
        } catch (err) {
            alert("❌ Error al leer el archivo. Asegúrate de que sea el archivo .json original.");
            console.error(err);
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function resetAppData() {
    if (confirm("¡Borrará TODOS los datos!")) {
        localStorage.removeItem('agriScoutData');
        location.reload();
    }
}

// --- SINCRONIZACIÓN EN LA NUBE (GOOGLE APPS SCRIPT) ---
async function uploadToCloud() {
    showToast("Subiendo datos a la nube... No cierres la app.");

    try {
        const response = await fetch(CLOUD_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(appData)
        });

        if (!response.ok) throw new Error("Network response was not ok");

        showToast("¡Datos enviados a la nube exitosamente!");
    } catch (error) {
        console.error("Error al subir:", error);
        alert("Hubo un error al conectar con la nube. Revisa tu conexión a internet.");
    }
}

async function downloadFromCloud() {
    showToast("Descargando datos desde la nube...");

    try {
        const response = await fetch(CLOUD_API_URL);
        if (!response.ok) throw new Error("Network response was not ok");

        const data = await response.json();

        if (data && data.zones && data.categories) {
            if (confirm("⚠️ ¡Atención! Estás a punto de reemplazar la información de este dispositivo con la de la nube. ¿Continuar?")) {
                appData = data;
                saveData();
                alert("Sincronización completada. La página se actualizará.");
                location.reload();
            }
        } else {
            alert("No se encontraron datos válidos en la nube o la base de datos está vacía.");
        }
    } catch (error) {
        console.error("Error al descargar:", error);
        alert("Hubo un error al descargar. Revisa tu conexión a internet o la configuración del script.");
    }
}