// --- PWA SERVICE WORKER REGISTRATION (MODO OFFLINE) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado para modo offline.', reg))
            .catch(err => console.error('Error en Service Worker:', err));
    });
}

// --- DATA STATE ---
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
        if(!appData.zones) appData.zones = [];
        if(!appData.categories) appData.categories = [];
        if(!appData.evaluations) appData.evaluations = [];
        if(!appData.treeTypes) appData.treeTypes = [];
        
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
function saveData() { localStorage.setItem('agriScoutData', JSON.stringify(appData)); }

// --- UI UTILS ---
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('text-emerald-600'); b.classList.add('text-slate-500'); });
    btnElement.classList.remove('text-slate-500'); btnElement.classList.add('text-emerald-600');

    if (tabId === 'zonas' && map) {
        setTimeout(() => {
            map.invalidateSize();
            if(drawnItems.getLayers().length > 0) map.fitBounds(drawnItems.getBounds(), {padding: [20,20]});
        }, 100);
    }
    if (tabId === 'config') { renderTreeTypes(); renderCategories(); }
    if (tabId === 'report') { updateReportZoneSelect(); refreshCurrentReport(); }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg; toast.classList.remove('opacity-0');
    setTimeout(() => toast.classList.add('opacity-0'), 3000);
}

// --- MAP & GPS ---
function initMap() {
    map = L.map('map').setView([-12.0464, -77.0428], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    map.addLayer(drawnItems); map.addLayer(drawingMarkers);
    renderZonesOnMap(); startGPS();
}

function startGPS() {
    const statusEl = document.getElementById('gpsStatus');
    document.getElementById('retryGpsBtn').classList.add('hidden');
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                currentLocation = { lat: position.coords.latitude, lng: position.coords.longitude, acc: position.coords.accuracy };
                document.getElementById('centerMapBtn').classList.remove('hidden');

                if(!userMarker) {
                    userMarker = L.circleMarker([currentLocation.lat, currentLocation.lng], { 
                        color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, radius: 8 
                    }).addTo(map).bindPopup('<b>📍 Tu Ubicación Actual</b>');
                    
                    if(appData.zones.length === 0 && appData.evaluations.length === 0) {
                        map.setView([currentLocation.lat, currentLocation.lng], 17);
                    }
                } else { 
                    userMarker.setLatLng([currentLocation.lat, currentLocation.lng]); 
                }
                statusEl.innerHTML = `<i class="fa-solid fa-satellite-dish text-green-500"></i> GPS Activo (Prec. ${Math.round(currentLocation.acc)}m)`;
            },
            (error) => {
                document.getElementById('retryGpsBtn').classList.remove('hidden');
                statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-red-500"></i> Error de GPS. Permita la ubicación.`;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }
}
function centerMapOnUser() { if (currentLocation && map) map.setView([currentLocation.lat, currentLocation.lng], 18); }

// --- ZONES ---
function renderZonesOnMap() {
    drawnItems.clearLayers();
    const listEl = document.getElementById('zonesList'); 
    listEl.innerHTML = '';
    
    appData.zones.forEach(zone => {
        if(zone.polygon && zone.polygon.length > 2) {
            L.polygon(zone.polygon, {color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 3}).addTo(drawnItems).bindPopup(`<b>Sector: ${zone.name}</b>`);
        }
        
        listEl.innerHTML += `
        <li class="py-3 flex justify-between items-center border-b last:border-0">
            <div class="flex flex-col">
                <span class="font-bold text-slate-700">${zone.name}</span>
                <span class="text-xs text-slate-500"><i class="fa-solid fa-tree text-emerald-500"></i> ${zone.totalTrees || 0} árboles totales</span>
            </div>
            <button onclick="deleteZone('${zone.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded transition"><i class="fa-solid fa-trash"></i></button>
        </li>`;
    });

    if (appData.evaluations && appData.evaluations.length > 0) {
        appData.evaluations.forEach(ev => {
            if(ev.lat && ev.lng) {
                L.circleMarker([ev.lat, ev.lng], {
                    color: '#ffffff', fillColor: '#ef4444', radius: 6, fillOpacity: 1, weight: 2
                }).addTo(drawnItems).bindPopup('<b>🌳 Árbol Evaluado</b>');
            }
        });
    }

    if(drawnItems.getLayers().length > 0) {
        setTimeout(() => { map.fitBounds(drawnItems.getBounds(), {padding: [20,20]}); }, 200);
    }
}

function startDrawingZone() {
    document.getElementById('startDrawingBtn').classList.add('hidden');
    document.getElementById('drawingControls').classList.remove('hidden'); document.getElementById('drawingControls').classList.add('flex');
    currentDrawingPoints = []; drawingMarkers.clearLayers();
    if(drawingPolygonLine) map.removeLayer(drawingPolygonLine);
    centerMapOnUser(); showToast("Camine por el borde y añada puntos GPS");
}

function addPointToZone() {
    if(!currentLocation) return showToast("Esperando GPS...");
    const pt = [currentLocation.lat, currentLocation.lng];
    currentDrawingPoints.push(pt);
    L.circleMarker(pt, {color: 'red', radius: 4, fillOpacity: 1}).addTo(drawingMarkers);
    if(drawingPolygonLine) map.removeLayer(drawingPolygonLine);
    
    if(currentDrawingPoints.length > 2) drawingPolygonLine = L.polygon(currentDrawingPoints, {color: '#f59e0b', fillColor: '#fcd34d', fillOpacity: 0.4}).addTo(map);
    else if(currentDrawingPoints.length > 0) drawingPolygonLine = L.polyline(currentDrawingPoints, {color: '#f59e0b', dashArray: '5, 5'}).addTo(map);
    centerMapOnUser(); showToast(`Punto ${currentDrawingPoints.length} guardado`);
}

function cancelDrawing() {
    document.getElementById('startDrawingBtn').classList.remove('hidden');
    document.getElementById('drawingControls').classList.add('hidden'); document.getElementById('drawingControls').classList.remove('flex');
    document.getElementById('newZoneName').value = '';
    document.getElementById('newZoneTrees').value = ''; 
    if(drawingPolygonLine) map.removeLayer(drawingPolygonLine);
    drawingMarkers.clearLayers(); currentDrawingPoints = [];
}

function saveZone() {
    const name = document.getElementById('newZoneName').value.trim();
    const trees = parseInt(document.getElementById('newZoneTrees').value);
    if(!name) return showToast("Falta nombre del sector");
    if(!trees || trees <= 0) return showToast("Ingrese un número válido de árboles");
    if(currentDrawingPoints.length < 3) return showToast("Mínimo 3 puntos GPS para un área");
    
    appData.zones.push({ id: 'zone_' + Date.now(), name: name, totalTrees: trees, polygon: currentDrawingPoints });
    saveData(); cancelDrawing(); renderZonesOnMap(); showToast("Sector guardado");
}

function deleteZone(id) { if(confirm("¿Eliminar sector?")) { appData.zones = appData.zones.filter(z => z.id !== id); saveData(); renderZonesOnMap(); } }

// --- CONFIG (TIPOS DE ÁRBOL) ---
function renderTreeTypes() {
    const list = document.getElementById('treeTypesList');
    list.innerHTML = '';
    if (!appData.treeTypes || appData.treeTypes.length === 0) {
        list.innerHTML = '<li class="text-xs text-slate-400 italic">No hay variedades configuradas.</li>';
        return;
    }
    appData.treeTypes.forEach(type => {
        list.innerHTML += `
            <li class="bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                ${type.name}
                <button onclick="deleteTreeType('${type.id}')" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-xmark"></i></button>
            </li>
        `;
    });
}

function addTreeType() {
    const name = document.getElementById('newTreeTypeName').value.trim();
    if (name) {
        if(!appData.treeTypes) appData.treeTypes = [];
        appData.treeTypes.push({ id: 'tt_' + Date.now(), name: name });
        saveData();
        document.getElementById('newTreeTypeName').value = '';
        renderTreeTypes();
    }
}

function deleteTreeType(id) {
    if(confirm("¿Eliminar este tipo de árbol? Las evaluaciones previas mantendrán el dato, pero no podrás elegirlo de nuevo.")) {
        appData.treeTypes = appData.treeTypes.filter(t => t.id !== id);
        saveData();
        renderTreeTypes();
    }
}

// --- CONFIG (CATEGORIAS) ---
function renderCategories() {
    const container = document.getElementById('categoriesContainer'); container.innerHTML = '';
    appData.categories.forEach(cat => {
        let itemsHTML = cat.items.map(item => {
            let labelsHTML = '';
            if (item.type === 'ordinal' && item.labels) {
                const numLabels = Object.keys(item.labels).length;
                for (let i = 1; i <= numLabels; i++) {
                    labelsHTML += `
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-emerald-600 w-3">${i}:</span>
                            <input type="text" value="${item.labels[i]}" onchange="updateItemLabel('${cat.id}', '${item.id}', ${i}, this.value)" class="border rounded px-2 py-1 flex-1 bg-slate-50 outline-none focus:ring-1 focus:ring-emerald-500">
                            ${numLabels > 2 ? `<button onclick="removeLevel('${cat.id}', '${item.id}', ${i})" class="text-red-400 hover:text-red-600 px-1" title="Eliminar nivel"><i class="fa-solid fa-xmark"></i></button>` : ''}
                        </div>
                    `;
                }
                if (numLabels < 4) {
                    labelsHTML += `<button onclick="addLevel('${cat.id}', '${item.id}')" class="text-xs text-emerald-600 font-bold mt-1 text-left hover:underline w-max"><i class="fa-solid fa-plus mr-1"></i>Añadir nivel</button>`;
                }
            }

            const lMin = item.limitMin !== undefined && item.limitMin !== null ? item.limitMin : '';
            const lMax = item.limitMax !== undefined && item.limitMax !== null ? item.limitMax : '';

            return `
            <div class="flex flex-col py-3 px-3 bg-slate-50 border-b">
                <div class="flex justify-between items-center w-full mb-1">
                    <div>
                        <span class="font-bold text-slate-700">${item.name}</span>
                        <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-2 uppercase font-bold tracking-wider">${item.type === 'cuantitativa' ? 'Valor numérico' : 'Niveles dinámicos'}</span>
                    </div>
                    <button onclick="deleteItem('${cat.id}', '${item.id}')" class="text-red-400 hover:text-red-600 p-1"><i class="fa-solid fa-xmark"></i></button>
                </div>
                
                <div class="flex gap-2 mt-2 mb-2 p-2 bg-indigo-50 border border-indigo-100 rounded text-xs shadow-sm">
                    <div class="flex-1 flex items-center gap-1">
                        <span class="font-bold text-indigo-800" title="Límite Inferior (Opcional)">Mín:</span>
                        <input type="number" step="0.01" value="${lMin}" placeholder="Ej: 5" onchange="updateItemLimit('${cat.id}', '${item.id}', 'min', this.value)" class="border rounded px-1 py-1 w-full bg-white outline-none focus:ring-1 focus:ring-indigo-500 text-center">
                    </div>
                    <div class="flex-1 flex items-center gap-1">
                        <span class="font-bold text-indigo-800" title="Límite Superior (Opcional)">Máx:</span>
                        <input type="number" step="0.01" value="${lMax}" placeholder="Ej: 15" onchange="updateItemLimit('${cat.id}', '${item.id}', 'max', this.value)" class="border rounded px-1 py-1 w-full bg-white outline-none focus:ring-1 focus:ring-indigo-500 text-center">
                    </div>
                </div>

                ${item.type === 'ordinal' ? `
                    <div class="mt-1 bg-white p-2 rounded text-xs border border-slate-200 shadow-sm">
                        <p class="font-bold text-slate-500 mb-1 text-[10px] uppercase">Significado de los niveles:</p>
                        <div class="flex flex-col gap-1">
                            ${labelsHTML}
                        </div>
                    </div>
                ` : ''}
            </div>`;
        }).join('');
            
        container.innerHTML += `
            <div class="bg-white rounded-lg shadow border overflow-hidden">
                <div class="bg-emerald-100 p-3 flex justify-between items-center">
                    <h4 class="font-bold text-emerald-800">${cat.name}</h4>
                    <button onclick="deleteCategory('${cat.id}')" class="text-red-500"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="p-2">${itemsHTML}
                    <div class="flex gap-2 mt-2 px-1 pb-1">
                        <input type="text" id="newItem_${cat.id}" placeholder="Nueva viñeta..." class="border p-2 rounded flex-1 outline-none focus:ring-2 focus:ring-emerald-500">
                        <select id="newType_${cat.id}" class="border p-2 rounded outline-none text-sm bg-slate-50 font-medium">
                            <option value="ordinal">Niveles (2 a 4)</option>
                            <option value="cuantitativa">Numérico (%)</option>
                        </select>
                        <button class="bg-slate-800 text-white px-3 rounded font-bold hover:bg-slate-700" onclick="addItem('${cat.id}')">Add</button>
                    </div>
                </div>
            </div>`;
    });
}
function addCategory() { const name = document.getElementById('newCatName').value.trim(); if(name) { appData.categories.push({ id: 'cat_' + Date.now(), name: name, items: [] }); saveData(); document.getElementById('newCatName').value=''; renderCategories(); } }
function deleteCategory(id) { if(confirm("¿Eliminar categoría?")) { appData.categories = appData.categories.filter(c => c.id !== id); saveData(); renderCategories(); } }

function addItem(catId) { 
    const name = document.getElementById(`newItem_${catId}`).value.trim(); 
    const type = document.getElementById(`newType_${catId}`).value;
    if(name) { 
        let newItem = { id: 'it_' + Date.now(), name: name, type: type, limitMin: null, limitMax: null };
        if (type === 'ordinal') {
            newItem.labels = {1: 'Nivel 1', 2: 'Nivel 2', 3: 'Nivel 3', 4: 'Nivel 4'};
        }
        appData.categories.find(c => c.id === catId).items.push(newItem); 
        saveData(); renderCategories(); 
    } 
}

function deleteItem(catId, itemId) {
    if(confirm("¿Eliminar viñeta?")) {
        const cat = appData.categories.find(c => c.id === catId);
        cat.items = cat.items.filter(i => i.id !== itemId);
        saveData(); renderCategories();
    }
}

function updateItemLabel(catId, itemId, level, value) {
    const cat = appData.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    if (item && item.labels) {
        item.labels[level] = value;
        saveData();
    }
}

function updateItemLimit(catId, itemId, type, value) {
    const cat = appData.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    if (item) {
        let numValue = value !== "" ? parseFloat(value) : null;
        if (type === 'min') item.limitMin = numValue;
        if (type === 'max') item.limitMax = numValue;
        saveData();
    }
}

function addLevel(catId, itemId) {
    const cat = appData.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    const numKeys = Object.keys(item.labels || {}).length;
    if (numKeys < 4) {
        item.labels[numKeys + 1] = `Nivel ${numKeys + 1}`;
        saveData(); renderCategories();
    }
}

function removeLevel(catId, itemId, levelToRemove) {
    const cat = appData.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    const numKeys = Object.keys(item.labels || {}).length;
    if (numKeys > 2) {
        let newLabels = {};
        let newIndex = 1;
        for (let i = 1; i <= numKeys; i++) {
            if (i !== levelToRemove) {
                newLabels[newIndex] = item.labels[i];
                newIndex++;
            }
        }
        item.labels = newLabels;
        saveData(); renderCategories();
    }
}

// --- EVALUAR ARBOL (CHECKLIST) ---
function isPointInPolygon(point, vs) {
    if (!vs || vs.length < 3) return false;
    let x = point[0], y = point[1], inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
        if (((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

function startEvaluation() {
    if(!currentLocation) return showToast("Esperando señal GPS para ubicar el árbol...");
    
    const zone = appData.zones.find(z => isPointInPolygon([currentLocation.lat, currentLocation.lng], z.polygon));
    
    currentEvaluation = {
        id: 'eval_' + Date.now(), timestamp: new Date().toISOString(),
        lat: currentLocation.lat, lng: currentLocation.lng,
        zoneId: zone ? zone.id : 'unknown', 
        treeTypeId: null,
        data: {}
    };

    document.getElementById('evalStartScreen').classList.add('hidden');
    document.getElementById('evaluationForm').classList.remove('hidden');
    document.getElementById('evalZoneName').innerHTML = zone ? `Sector: <span class="text-emerald-600 font-black">${zone.name}</span>` : '<span class="text-red-500 font-bold">Fuera de los sectores</span>';
    document.getElementById('evalCoords').textContent = `Lat: ${currentLocation.lat.toFixed(5)}, Lng: ${currentLocation.lng.toFixed(5)}`;
    
    const ttContainer = document.getElementById('evalTreeTypeContainer');
    const ttSelect = document.getElementById('evalTreeTypeSelect');
    if (appData.treeTypes && appData.treeTypes.length > 0) {
        ttSelect.innerHTML = '<option value="">-- No especificado --</option>';
        appData.treeTypes.forEach(tt => {
            ttSelect.innerHTML += `<option value="${tt.id}">${tt.name}</option>`;
        });
        ttContainer.classList.remove('hidden');
    } else {
        ttContainer.classList.add('hidden');
    }

    const statsContainer = document.getElementById('evalSamplingStats');
    if (zone && zone.totalTrees) {
        const evalsDone = appData.evaluations.filter(e => e.zoneId === zone.id).length;
        const minReq = Math.ceil(zone.totalTrees * 0.01);
        const optReq = Math.ceil(zone.totalTrees * 0.05);
        statsContainer.classList.remove('hidden');
        statsContainer.innerHTML = `
            <p class="font-bold text-blue-900 mb-1">Muestreo del Sector:</p>
            <div class="flex justify-between text-xs font-bold mb-1"><span>Evaluados: ${evalsDone}</span> <span>Mínimo (1%): ${minReq}</span></div>
            <div class="w-full bg-blue-200 rounded-full h-2 mb-2"><div class="bg-blue-600 h-2 rounded-full" style="width: ${Math.min((evalsDone/minReq)*100, 100)}%"></div></div>
            <p class="text-[11px] font-bold text-blue-700 italic"><i class="fa-solid fa-person-walking mr-1"></i>¡Camina! Toma muestras de árboles separados para que sea representativo. (Óptimo 5%: ${optReq} árboles).</p>
        `;
    } else {
        statsContainer.classList.add('hidden');
    }
    
    renderEvaluationForm();
}

function renderEvaluationForm() {
    const container = document.getElementById('evalCategoriesContainer'); container.innerHTML = '';
    appData.categories.forEach(cat => {
        let itemsHTML = cat.items.map(item => {
            const isQuantitative = item.type === 'cuantitativa';
            let inputField = '';

            if (isQuantitative) {
                inputField = `<label class="text-xs text-blue-800 font-bold mb-1 block uppercase">Ingrese Valor Numérico:</label>
                 <input type="number" step="0.01" class="w-full border border-blue-300 p-2 rounded font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej. 15.5" oninput="setSeverity('${item.id}', this.value)">`;
            } else {
                const numLevels = Object.keys(item.labels || {}).length;
                let optionsHTML = '';
                for(let i = 1; i <= numLevels; i++) {
                    optionsHTML += `<option value="${i}">${i} - ${item.labels[i]}</option>`;
                }

                inputField = `
                 <label class="text-xs text-emerald-800 font-bold mb-1 block uppercase">Intensidad (1 al ${numLevels}):</label>
                 <select class="w-full border border-gray-300 p-2 rounded font-bold outline-none text-sm" onchange="setSeverity('${item.id}', this.value)">
                    ${optionsHTML}
                 </select>`;
            }

            return `
            <div class="p-3 border-b bg-white" id="eval_item_${item.id}">
                <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                    <span class="font-bold text-slate-700">${item.name}</span>
                    <div class="flex items-center bg-gray-100 rounded-lg p-1 border">
                        <button id="btn_ausencia_${item.id}" class="px-4 py-2 text-sm font-bold rounded bg-white shadow-sm text-slate-800 w-full" onclick="setPresence('${item.id}', false)">Ausencia (0)</button>
                        <button id="btn_presencia_${item.id}" class="px-4 py-2 text-sm font-bold rounded text-slate-500 hover:bg-gray-200 w-full" onclick="setPresence('${item.id}', true)">Presencia</button>
                    </div>
                </div>
                <div id="severity_container_${item.id}" class="hidden mt-2 ${isQuantitative ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-emerald-200'} p-3 rounded-lg border">
                    ${inputField}
                </div>
            </div>`;
        }).join('');
        container.innerHTML += `<div class="border rounded-lg shadow-sm mb-3"><div class="bg-emerald-700 px-3 py-2 font-bold text-white uppercase tracking-wider">${cat.name}</div>${itemsHTML}</div>`;
    });
}

function setPresence(itemId, isPresent) {
    if(!currentEvaluation.data[itemId]) currentEvaluation.data[itemId] = {};
    const bAus = document.getElementById(`btn_ausencia_${itemId}`), bPre = document.getElementById(`btn_presencia_${itemId}`);
    const sCont = document.getElementById(`severity_container_${itemId}`);
    if(isPresent) {
        bAus.className = "px-4 py-2 text-sm font-bold rounded text-slate-500 hover:bg-gray-200 w-full"; bPre.className = "px-4 py-2 text-sm font-bold rounded bg-emerald-600 shadow-sm text-white w-full";
        sCont.classList.remove('hidden');
        currentEvaluation.data[itemId].presence = true; 
        const inputEl = sCont.querySelector('select, input');
        currentEvaluation.data[itemId].severity = inputEl.value || null;
    } else {
        bPre.className = "px-4 py-2 text-sm font-bold rounded text-slate-500 hover:bg-gray-200 w-full"; bAus.className = "px-4 py-2 text-sm font-bold rounded bg-white shadow-sm text-slate-800 w-full";
        sCont.classList.add('hidden');
        currentEvaluation.data[itemId].presence = false; currentEvaluation.data[itemId].severity = null;
    }
}

function setSeverity(itemId, level) { if(!currentEvaluation.data[itemId]) currentEvaluation.data[itemId] = { presence: true }; currentEvaluation.data[itemId].severity = level; }

function cancelEvaluation() {
    currentEvaluation = null; 
    document.getElementById('evalStartScreen').classList.remove('hidden'); 
    document.getElementById('evaluationForm').classList.add('hidden');
}

function saveEvaluation() {
    if (appData.treeTypes && appData.treeTypes.length > 0) {
        const selectedType = document.getElementById('evalTreeTypeSelect').value;
        currentEvaluation.treeTypeId = selectedType !== "" ? selectedType : null;
    }

    appData.categories.forEach(cat => { cat.items.forEach(item => { if(!currentEvaluation.data[item.id] || currentEvaluation.data[item.id].presence === undefined) { currentEvaluation.data[item.id] = { presence: false, severity: null }; } }); });
    appData.evaluations.push(currentEvaluation); saveData(); showToast("✅ Árbol guardado correctamente en su sector"); cancelEvaluation();
}

// --- REPORTES Y TRAZABILIDAD ---
function updateReportZoneSelect() {
    const select = document.getElementById('reportZoneSelect');
    select.innerHTML = '<option value="all">Todas las Zonas (Desglose General)</option>';
    appData.zones.forEach(z => select.innerHTML += `<option value="${z.id}">${z.name}</option>`);

    const ttSelect = document.getElementById('reportTreeTypeSelect');
    if (appData.treeTypes && appData.treeTypes.length > 0) {
        ttSelect.innerHTML = '<option value="all">Todas las Variedades</option>';
        ttSelect.innerHTML += '<option value="none">Sin variedad asignada</option>'; 
        appData.treeTypes.forEach(tt => ttSelect.innerHTML += `<option value="${tt.id}">${tt.name}</option>`);
        ttSelect.classList.remove('hidden');
    } else {
        ttSelect.classList.add('hidden');
    }

    // Inicializar opciones de gráfica
    updateChartCategorySelect();
}

// --- FUNCIONES PARA GRÁFICA DE EVOLUCIÓN ---
function updateChartCategorySelect() {
    const catSelect = document.getElementById('chartCategorySelect');
    catSelect.innerHTML = '';
    appData.categories.forEach(cat => {
        if (cat.items.length > 0) {
            catSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        }
    });
    updateChartItemSelect();
}

function updateChartItemSelect() {
    const catId = document.getElementById('chartCategorySelect').value;
    const itemSelect = document.getElementById('chartItemSelect');
    itemSelect.innerHTML = '';
    
    const cat = appData.categories.find(c => c.id === catId);
    if (cat && cat.items) {
        cat.items.forEach(item => {
            itemSelect.innerHTML += `<option value="${item.id}">${item.name} ${item.type === 'cuantitativa' ? '(Promedio Numérico)' : '(% de Incidencia)'}</option>`;
        });
    }
    
    if(currentReportView === 'chart') generateChartReport();
}

// Función auxiliar para obtener el número de semana ISO de una fecha
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return [d.getUTCFullYear(), weekNo];
}

// --- FUNCIONES DE CONTROL DE VISTA Y FECHAS ---
function switchReportView(view) {
    currentReportView = view;
    const btnVis = document.getElementById('btnViewVisual');
    const btnTab = document.getElementById('btnViewTable');
    const btnChart = document.getElementById('btnViewChart');
    
    const contVis = document.getElementById('reportContent');
    const contTab = document.getElementById('tableContent');
    const contChart = document.getElementById('chartContent');
    
    const optTab = document.getElementById('tableOptionsContainer');
    const optChart = document.getElementById('chartOptionsContainer');
    const btnPdf = document.getElementById('btnExportPDF');

    // Resetear todos los estilos de botones
    [btnVis, btnTab, btnChart].forEach(btn => {
        btn.className = "flex-1 py-2 font-bold rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 text-sm";
    });

    // Ocultar todos los contenedores
    [contVis, contTab, contChart, optTab, optChart].forEach(cont => {
        cont.classList.add('hidden');
    });
    optTab.classList.remove('flex');

    if (view === 'visual') {
        btnVis.className = "flex-1 py-2 font-bold rounded-lg bg-emerald-600 text-white shadow text-sm";
        contVis.classList.remove('hidden');
        btnPdf.classList.remove('hidden');
        generateReport();
    } else if (view === 'table') {
        btnTab.className = "flex-1 py-2 font-bold rounded-lg bg-emerald-600 text-white shadow text-sm";
        contTab.classList.remove('hidden');
        optTab.classList.remove('hidden'); 
        optTab.classList.add('flex');
        btnPdf.classList.add('hidden');
        generateTableReport();
    } else if (view === 'chart') {
        btnChart.className = "flex-1 py-2 font-bold rounded-lg bg-purple-600 text-white shadow text-sm";
        contChart.classList.remove('hidden');
        optChart.classList.remove('hidden');
        btnPdf.classList.add('hidden');
        // Si es la primera vez que se entra, inicializar los selectores
        if (document.getElementById('chartCategorySelect').options.length === 0) {
            updateChartCategorySelect();
        } else {
            generateChartReport();
        }
    }
}

function refreshCurrentReport() {
    if (currentReportView === 'visual') generateReport();
    else if (currentReportView === 'table') generateTableReport();
    else if (currentReportView === 'chart') generateChartReport();
}

function clearDateFilters() {
    document.getElementById('reportDateStart').value = '';
    document.getElementById('reportDateEnd').value = '';
    refreshCurrentReport();
}

function getFilteredEvaluations() {
    const zoneId = document.getElementById('reportZoneSelect').value;
    const treeTypeId = document.getElementById('reportTreeTypeSelect') ? document.getElementById('reportTreeTypeSelect').value : 'all';
    const dateStart = document.getElementById('reportDateStart').value;
    const dateEnd = document.getElementById('reportDateEnd').value;

    let evals = appData.evaluations;

    if (zoneId !== 'all') evals = evals.filter(e => e.zoneId === zoneId);
    
    if (treeTypeId !== 'all') {
        if (treeTypeId === 'none') evals = evals.filter(e => !e.treeTypeId);
        else evals = evals.filter(e => e.treeTypeId === treeTypeId);
    }

    if (dateStart) {
        const dStart = new Date(dateStart + 'T00:00:00');
        evals = evals.filter(e => new Date(e.timestamp) >= dStart);
    }
    if (dateEnd) {
        const dEnd = new Date(dateEnd + 'T23:59:59');
        evals = evals.filter(e => new Date(e.timestamp) <= dEnd);
    }

    return evals;
}

function generateReport() {
    const zoneId = document.getElementById('reportZoneSelect').value;
    const treeTypeId = document.getElementById('reportTreeTypeSelect') ? document.getElementById('reportTreeTypeSelect').value : 'all';
    
    const stats = document.getElementById('reportStats');
    document.getElementById('reportDate').textContent = `Generado: ${new Date().toLocaleString()}`;
    
    let titleText = `Filtro: ${zoneId === 'all' ? 'Todos los sectores' : (appData.zones.find(z=>z.id===zoneId)?.name)}`;
    if (appData.treeTypes && appData.treeTypes.length > 0 && treeTypeId !== 'all') {
        const ttName = treeTypeId === 'none' ? 'Sin variedad' : appData.treeTypes.find(t=>t.id===treeTypeId)?.name;
        titleText += ` | Variedad: ${ttName}`;
    }
    const dStart = document.getElementById('reportDateStart').value;
    const dEnd = document.getElementById('reportDateEnd').value;
    if (dStart || dEnd) titleText += ` | Fechas: ${dStart || 'Inicio'} a ${dEnd || 'Hoy'}`;
    
    document.getElementById('reportZoneTitle').textContent = titleText;
    
    if (!window.reportMapInstance) {
        window.reportMapInstance = L.map('reportMapContainer', { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView([-12.0464, -77.0428], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(window.reportMapInstance);
        window.reportMapLayer = L.featureGroup().addTo(window.reportMapInstance);
    }
    window.reportMapLayer.clearLayers();

    let zonesToReport = zoneId === 'all' ? [...appData.zones, {id: 'unknown', name: 'Fuera de sectores dibujados'}] : [appData.zones.find(z=>z.id===zoneId) || {id: 'unknown', name: 'Fuera de sectores'}];
    
    let evalsToPlot = getFilteredEvaluations();

    zonesToReport.forEach(z => { 
        if(z.polygon && z.polygon.length > 2) {
            L.polygon(z.polygon, {color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 2}).addTo(window.reportMapLayer); 
        }
    });
    evalsToPlot.forEach(ev => { 
        if(ev.lat && ev.lng) {
            L.circleMarker([ev.lat, ev.lng], {color: '#ffffff', fillColor: '#ef4444', radius: 5, fillOpacity: 1, weight: 1}).addTo(window.reportMapLayer); 
        }
    });

    setTimeout(() => {
        window.reportMapInstance.invalidateSize();
        if(window.reportMapLayer.getLayers().length > 0) {
            window.reportMapInstance.fitBounds(window.reportMapLayer.getBounds(), {padding: [15,15]});
        }
    }, 300);

    let html = ''; let totalGeneral = 0;

    zonesToReport.forEach(targetZone => {
        let evals = evalsToPlot.filter(e => e.zoneId === targetZone.id);

        if (evals.length === 0) return; 
        totalGeneral += evals.length;

        html += `<div class="mb-8 border-4 border-emerald-600 rounded-xl p-4 bg-white shadow-md page-break-inside-avoid">`;
        html += `<h2 class="text-2xl font-black text-emerald-900 mb-4 bg-emerald-100 p-3 rounded-lg text-center uppercase tracking-widest">Sector: ${targetZone.name} <span class="text-sm normal-case font-bold text-emerald-700 ml-2">(${evals.length} árboles evaluados)</span></h2>`;

        appData.categories.forEach(cat => {
            if(cat.items.length === 0) return;
            html += `<div class="mb-6"><h3 class="text-lg font-bold text-slate-800 mb-3 border-b-2 border-emerald-400 pb-1 uppercase">${cat.name}</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;

            cat.items.forEach(item => {
                let pCount = 0;
                let sumQuant = 0; 
                const isQuant = item.type === 'cuantitativa';
                
                let sCounts = {};
                let numLevels = 0;
                if (!isQuant) {
                    numLevels = Object.keys(item.labels || {}).length;
                    for(let i = 1; i <= numLevels; i++) sCounts[i] = 0;
                }

                evals.forEach(ev => { 
                    if(ev.data[item.id] && ev.data[item.id].presence) { 
                        pCount++; 
                        if(isQuant) {
                            let val = parseFloat(ev.data[item.id].severity);
                            if(!isNaN(val)) sumQuant += val;
                        } else {
                            let sev = ev.data[item.id].severity;
                            if(sev && sCounts[sev] !== undefined) sCounts[sev]++; 
                        }
                    } 
                });
                
                const incPct = parseFloat(((pCount / evals.length) * 100).toFixed(1));
                
                let detailHTML = '';
                if (isQuant) {
                    let avg = pCount > 0 ? (sumQuant / pCount).toFixed(2) : 0;
                    let limitMessageHTML = '';

                    if (pCount > 0 && (item.limitMin !== null && item.limitMin !== undefined || item.limitMax !== null && item.limitMax !== undefined)) {
                        let numAvg = parseFloat(avg);
                        let isLow = item.limitMin !== null && item.limitMin !== undefined && numAvg < item.limitMin;
                        let isHigh = item.limitMax !== null && item.limitMax !== undefined && numAvg > item.limitMax;

                        if (isHigh) {
                            limitMessageHTML = `<div class="mt-2 text-center text-xs font-bold text-red-700 bg-red-100 p-1.5 rounded border border-red-300"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Sobre el límite superior (${item.limitMax})</div>`;
                        } else if (isLow) {
                            limitMessageHTML = `<div class="mt-2 text-center text-xs font-bold text-orange-700 bg-orange-100 p-1.5 rounded border border-orange-300"><i class="fa-solid fa-arrow-down mr-1"></i>Bajo el límite inferior (${item.limitMin})</div>`;
                        } else {
                            limitMessageHTML = `<div class="mt-2 text-center text-xs font-bold text-emerald-700 bg-emerald-100 p-1.5 rounded border border-emerald-300"><i class="fa-solid fa-check mr-1"></i>Dentro de los límites óptimos</div>`;
                        }
                    }

                    detailHTML = `
                        <div class="flex justify-between text-sm text-slate-700 font-medium mb-3">
                            <span>Árboles reportados: <b>${pCount}/${evals.length}</b></span>
                            <span>Promedio general: <b>${pCount > 0 ? avg : '-'}</b></span>
                        </div>
                        ${pCount > 0 ? `
                            <div class="text-center font-black text-blue-800 bg-blue-100 py-3 rounded border border-blue-300 shadow-sm text-lg">
                                VALOR PROMEDIO: ${avg}
                            </div>
                            ${limitMessageHTML}
                        ` : `<div class="text-center font-bold text-emerald-700 bg-emerald-50 py-2 rounded border border-emerald-100">Cero Presencia (0)</div>`}
                    `;
                } else {
                    let pred = "Ninguno", max = 0; 
                    for (const [k, v] of Object.entries(sCounts)) { 
                        if(v > max) { 
                            max = v; 
                            pred = item.labels && item.labels[k] ? item.labels[k] : "Nivel " + k; 
                        } 
                    }
                    
                    let boxesHTML = '';
                    const colors = [
                        {bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300'},
                        {bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300'},
                        {bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300'},
                        {bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300'}
                    ];
                    for(let i = 1; i <= numLevels; i++) {
                        const c = colors[i-1];
                        const labelText = item.labels && item.labels[i] ? item.labels[i] : 'Nivel ' + i;
                        boxesHTML += `
                            <div class="flex-1 flex flex-col justify-center ${c.bg} ${c.text} py-2 rounded border ${c.border} shadow-sm px-1" title="Nivel ${i}: ${labelText}">
                                <span class="text-xs font-black mb-1 truncate">${labelText}</span>
                                <span class="text-sm font-bold bg-white/50 rounded-full w-6 h-6 mx-auto flex items-center justify-center">${sCounts[i]}</span>
                            </div>`;
                    }

                    let limitMessageHTML = '';
                    if (pCount > 0 && (item.limitMin !== null && item.limitMin !== undefined || item.limitMax !== null && item.limitMax !== undefined)) {
                        let isLow = item.limitMin !== null && item.limitMin !== undefined && incPct < item.limitMin;
                        let isHigh = item.limitMax !== null && item.limitMax !== undefined && incPct > item.limitMax;

                        if (isHigh) {
                            limitMessageHTML = `<div class="mt-2 text-center text-xs font-bold text-red-700 bg-red-100 p-1.5 rounded border border-red-300"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Incidencia ALERTA: Sobre límite (${item.limitMax}%)</div>`;
                        } else if (isLow) {
                            limitMessageHTML = `<div class="mt-2 text-center text-xs font-bold text-orange-700 bg-orange-100 p-1.5 rounded border border-orange-300"><i class="fa-solid fa-arrow-down mr-1"></i>Incidencia por debajo del mínimo esperado (${item.limitMin}%)</div>`;
                        } else {
                            limitMessageHTML = `<div class="mt-2 text-center text-xs font-bold text-emerald-700 bg-emerald-100 p-1.5 rounded border border-emerald-300"><i class="fa-solid fa-check mr-1"></i>Incidencia dentro de umbrales permitidos</div>`;
                        }
                    }

                    detailHTML = `
                        <div class="flex justify-between text-sm text-slate-700 font-medium mb-3">
                            <span>Afectados: <b>${pCount}/${evals.length}</b></span>
                            <span>Predomina: <b>${pCount > 0 ? pred : '-'}</b></span>
                        </div>
                        ${pCount > 0 ? `
                            <div class="flex gap-1 text-center text-[10px] font-bold">
                                ${boxesHTML}
                            </div>
                            ${limitMessageHTML}
                        ` : `<div class="text-center font-bold text-emerald-700 bg-emerald-50 py-2 rounded border border-emerald-100">Cero Presencia Registrada (0)</div>`}
                    `;
                }

                let limitsInfoHTML = '';
                const hasMin = item.limitMin !== null && item.limitMin !== undefined && item.limitMin !== '';
                const hasMax = item.limitMax !== null && item.limitMax !== undefined && item.limitMax !== '';
                
                if (hasMin || hasMax) {
                    let lText = [];
                    if (hasMin) lText.push(`Mín: ${item.limitMin}${isQuant ? '' : '%'}`);
                    if (hasMax) lText.push(`Máx: ${item.limitMax}${isQuant ? '' : '%'}`);
                    
                    limitsInfoHTML = `
                        <div class="mt-1 mb-2">
                            <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded uppercase tracking-wide">
                                <i class="fa-solid fa-circle-info mr-1"></i> Parámetros: ${lText.join(' | ')}
                            </span>
                        </div>
                    `;
                }

                html += `
                    <div class="bg-slate-50 p-4 rounded-lg border shadow-sm">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-lg text-slate-800">${item.name}</span>
                            <span class="text-sm font-black ${incPct > 0 ? 'text-red-600' : 'text-emerald-600'}">${incPct}% Incidencia</span>
                        </div>
                        ${limitsInfoHTML}
                        <div class="w-full bg-gray-200 rounded-full h-3 mb-3 mt-1">
                            <div class="${incPct > 50 ? 'bg-red-500' : (incPct > 0 ? 'bg-yellow-500' : 'bg-emerald-500')} h-3 rounded-full" style="width: ${incPct}%"></div>
                        </div>
                        ${detailHTML}
                    </div>`;
            });
            html += `</div></div>`;
        });
        html += `</div>`; 
    });

    if (totalGeneral === 0) stats.innerHTML = `<p class="text-center font-bold text-slate-400 py-8">0 árboles evaluados en este rango/selección.</p>`;
    else stats.innerHTML = html;
}

// --- TABLA HISTÓRICA (TRAZABILIDAD) ---
function generateTableReport() {
    const container = document.getElementById('tableContainer');
    const diffTreeType = document.getElementById('chkDiffTreeType').checked;
    let evals = getFilteredEvaluations();

    if (evals.length === 0) {
        container.innerHTML = `<p class="text-center font-bold text-slate-400 py-8">No hay datos para las fechas/filtros seleccionados.</p>`;
        return;
    }

    // 1. Agrupar datos. Estructura: grouped[zoneId][treeTypeId(o 'combined')][fecha(YYYY-MM-DD)] = [evaluaciones]
    let grouped = {};
    
    evals.forEach(ev => {
        const zId = ev.zoneId || 'unknown';
        const tId = diffTreeType ? (ev.treeTypeId || 'none') : 'combined';
        const dateStr = ev.timestamp.split('T')[0];

        if (!grouped[zId]) grouped[zId] = {};
        if (!grouped[zId][tId]) grouped[zId][tId] = {};
        if (!grouped[zId][tId][dateStr]) grouped[zId][tId][dateStr] = [];
        
        grouped[zId][tId][dateStr].push(ev);
    });

    let html = '';

    // Iterar por Zona
    for (const zId in grouped) {
        const zoneName = appData.zones.find(z => z.id === zId)?.name || 'Fuera de sectores';
        
        // Iterar por Tipo de Árbol (si está combinado, iterará 1 vez)
        for (const tId in grouped[zId]) {
            let treeTypeName = "";
            if (diffTreeType) {
                treeTypeName = tId === 'none' ? 'Sin Variedad' : (appData.treeTypes.find(t => t.id === tId)?.name || 'Desconocido');
            }

            const titleHeader = diffTreeType ? `${zoneName} <span class="text-blue-200">| Variedad: ${treeTypeName}</span>` : zoneName;

            html += `<div class="mb-8">`;
            html += `<table class="w-full text-sm text-left whitespace-nowrap">`;
            
            // --- ENCABEZADOS DE LA TABLA ---
            html += `<thead class="text-xs uppercase bg-slate-800 text-white">`;
            
            // Fila 1: Título de Zona y Categorías
            html += `<tr>`;
            html += `<th rowspan="2" class="px-4 py-3 border border-slate-700 bg-slate-900 text-base min-w-[120px] sticky left-0 z-10">${titleHeader} <br><span class="text-[10px] text-slate-400 font-normal normal-case">(Ordenado de antiguo a reciente)</span></th>`;
            
            appData.categories.forEach(cat => {
                if (cat.items.length > 0) {
                    html += `<th colspan="${cat.items.length}" class="px-4 py-2 border border-slate-700 text-center bg-emerald-700">${cat.name}</th>`;
                }
            });
            html += `</tr>`;

            // Fila 2: Viñetas (Items) con sus límites
            html += `<tr>`;
            appData.categories.forEach(cat => {
                cat.items.forEach(item => {
                    let limitText = '';
                    if (item.limitMin !== null && item.limitMin !== undefined) limitText += `Mín:${item.limitMin} `;
                    if (item.limitMax !== null && item.limitMax !== undefined) limitText += `Máx:${item.limitMax}`;
                    
                    html += `<th class="px-4 py-2 border border-slate-700 text-center bg-slate-700">
                        <div class="font-bold">${item.name}</div>
                        ${limitText ? `<div class="text-[9px] text-emerald-300 normal-case mt-1 tracking-wider">${limitText}</div>` : ''}
                        <div class="text-[9px] text-slate-400 normal-case">${item.type === 'cuantitativa' ? '(Promedio)' : '(% Incidencia)'}</div>
                    </th>`;
                });
            });
            html += `</tr></thead>`;

            // --- CUERPO DE LA TABLA (FILAS = FECHAS) ---
            html += `<tbody>`;
            
            // Obtener todas las fechas de este grupo y ordenarlas de antigua a reciente
            let dates = Object.keys(grouped[zId][tId]).sort((a, b) => new Date(a) - new Date(b));

            dates.forEach(date => {
                const dayEvals = grouped[zId][tId][date];
                const dateFormatted = date.split('-').reverse().join('/');
                
                html += `<tr class="bg-white border-b hover:bg-emerald-50">`;
                html += `<td class="px-4 py-3 border border-slate-200 font-bold text-slate-700 sticky left-0 bg-white z-10">${dateFormatted} <span class="text-xs font-normal text-slate-400 ml-1">(n=${dayEvals.length})</span></td>`;

                appData.categories.forEach(cat => {
                    cat.items.forEach(item => {
                        let pCount = 0; let sumQuant = 0;
                        const isQuant = item.type === 'cuantitativa';

                        dayEvals.forEach(ev => {
                            if(ev.data[item.id] && ev.data[item.id].presence) {
                                pCount++;
                                if(isQuant) {
                                    let val = parseFloat(ev.data[item.id].severity);
                                    if(!isNaN(val)) sumQuant += val;
                                }
                            }
                        });

                        let cellHTML = '-';
                        let cellClass = "text-slate-400 text-center";

                        if (pCount > 0) {
                            if (isQuant) {
                                let avg = (sumQuant / pCount).toFixed(1);
                                cellHTML = avg;
                                cellClass = "text-blue-700 font-bold text-center bg-blue-50";
                                
                                if (item.limitMax !== null && item.limitMax !== undefined && parseFloat(avg) > item.limitMax) cellClass = "text-red-700 font-bold text-center bg-red-100";
                                else if (item.limitMin !== null && item.limitMin !== undefined && parseFloat(avg) < item.limitMin) cellClass = "text-orange-700 font-bold text-center bg-orange-100";
                                
                            } else {
                                let incPct = ((pCount / dayEvals.length) * 100).toFixed(0) + '%';
                                cellHTML = incPct;
                                cellClass = "text-emerald-700 font-bold text-center bg-emerald-50";
                                
                                let numPct = parseFloat(incPct);
                                if (item.limitMax !== null && item.limitMax !== undefined && numPct > item.limitMax) cellClass = "text-red-700 font-bold text-center bg-red-100";
                                else if (item.limitMin !== null && item.limitMin !== undefined && numPct < item.limitMin) cellClass = "text-orange-700 font-bold text-center bg-orange-100";
                            }
                        } else if (dayEvals.length > 0) {
                             cellHTML = '0';
                             cellClass = "text-emerald-500 font-medium text-center";
                        }

                        html += `<td class="px-4 py-2 border border-slate-200 ${cellClass}">${cellHTML}</td>`;
                    });
                });

                html += `</tr>`;
            });

            html += `</tbody></table></div>`;
        }
    }

    container.innerHTML = html;
}

// --- GRÁFICA DE EVOLUCIÓN ---
function generateChartReport() {
    const catId = document.getElementById('chartCategorySelect').value;
    const itemId = document.getElementById('chartItemSelect').value;
    const zoneId = document.getElementById('reportZoneSelect').value;
    
    if(!catId || !itemId) return;

    const cat = appData.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    if(!item) return;

    const isQuant = item.type === 'cuantitativa';
    let evals = getFilteredEvaluations();
    
    const chartNoData = document.getElementById('chartNoDataMsg');
    const canvasContainer = document.getElementById('evolutionChart').parentElement;

    if (evals.length === 0) {
        chartNoData.classList.remove('hidden');
        canvasContainer.classList.add('hidden');
        return;
    }

    // Agrupar por "Año - Semana"
    let groupedByWeek = {};
    
    evals.forEach(ev => {
        const date = new Date(ev.timestamp);
        const [year, weekNum] = getWeekNumber(date);
        const weekKey = `${year} - Sem ${weekNum}`;
        
        if(!groupedByWeek[weekKey]) {
            const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            groupedByWeek[weekKey] = { evals: [], label: `Sem ${weekNum}\n(${dateStr})`, sortKey: date.getTime() };
        }
        groupedByWeek[weekKey].evals.push(ev);
    });

    // Ordenar las semanas cronológicamente
    const sortedWeeks = Object.values(groupedByWeek).sort((a, b) => a.sortKey - b.sortKey);
    
    if (sortedWeeks.length === 0) {
        chartNoData.classList.remove('hidden');
        canvasContainer.classList.add('hidden');
        return;
    }

    chartNoData.classList.add('hidden');
    canvasContainer.classList.remove('hidden');

    const labels = sortedWeeks.map(w => w.label);
    const dataPoints = [];

    // Calcular el valor (Promedio o %) para cada semana
    sortedWeeks.forEach(weekData => {
        let pCount = 0;
        let sumQuant = 0;

        weekData.evals.forEach(ev => {
            if(ev.data[itemId] && ev.data[itemId].presence) {
                pCount++;
                if(isQuant) {
                    let val = parseFloat(ev.data[itemId].severity);
                    if(!isNaN(val)) sumQuant += val;
                }
            }
        });

        if (isQuant) {
            let avg = pCount > 0 ? (sumQuant / pCount).toFixed(2) : 0;
            dataPoints.push(parseFloat(avg));
        } else {
            let incPct = ((pCount / weekData.evals.length) * 100).toFixed(1);
            dataPoints.push(parseFloat(incPct));
        }
    });

    // Actualizar Títulos
    const zoneName = zoneId === 'all' ? 'Todos los sectores' : (appData.zones.find(z=>z.id===zoneId)?.name || 'Sector');
    document.getElementById('chartTitle').textContent = `Evolución: ${item.name}`;
    document.getElementById('chartSubtitle').textContent = `${zoneName} | ${isQuant ? 'Promedio Numérico' : '% Incidencia de Afectados'}`;

    // Destruir gráfica anterior si existe
    if (chartInstance) {
        chartInstance.destroy();
    }

    // Configurar Chart.js
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    
    const datasets = [{
        label: isQuant ? 'Valor Promedio' : '% Incidencia',
        data: dataPoints,
        borderColor: '#7e22ce',
        backgroundColor: 'rgba(126, 34, 206, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#7e22ce',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.3
    }];

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y + (isQuant ? '' : '%');
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: isQuant ? undefined : 100,
                    title: {
                        display: true,
                        text: isQuant ? 'Valor Promedio' : 'Porcentaje (%)',
                        color: '#64748b',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#f1f5f9' }
                },
                x: {
                    ticks: { maxRotation: 45, minRotation: 45 },
                    grid: { display: false }
                }
            }
        }
    });
}

// --- FUNCIONES DE EXPORTACIÓN ---
function exportPDF() {
    html2pdf().set({ margin: 10, filename: 'AgriScout_Reporte.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(document.getElementById('reportContent')).save();
}

function exportTableToPDF() {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer.innerHTML.includes('<table')) return showToast("No hay tabla para exportar");

    showToast("Generando PDF, por favor espere...");

    const clonedContainer = tableContainer.cloneNode(true);
    
    const printWrapper = document.createElement('div');
    printWrapper.style.padding = '20px';
    printWrapper.style.backgroundColor = '#ffffff';
    printWrapper.style.color = '#000000';
    clonedContainer.classList.remove('overflow-x-auto');
    
    const dateStr = new Date().toLocaleString();
    const headerHtml = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="font-size: 24px; font-weight: bold; color: #065f46; margin: 0;">REPORTE HISTÓRICO - AGRISCOUT</h1>
            <p style="font-size: 12px; color: #64748b; margin: 5px 0;">Generado: ${dateStr}</p>
        </div>
    `;
    printWrapper.innerHTML = headerHtml;
    printWrapper.appendChild(clonedContainer);

    const opt = {
        margin:       10,
        filename:     `AgriScout_Tabla_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            backgroundColor: '#ffffff'
        },
        jsPDF:        { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'landscape'
        }
    };

    html2pdf().set(opt).from(printWrapper).save().then(() => {
        showToast("PDF descargado correctamente");
    }).catch(err => {
        console.error("Error al generar PDF:", err);
        showToast("Error al generar el PDF");
    });
}

function exportCSV() {
    let evals = getFilteredEvaluations();
    if(evals.length === 0) return showToast("No hay datos para exportar");
    let csv = "data:text/csv;charset=utf-8,ID_Evaluacion,Fecha,Latitud,Longitud,Sector,Variedad_Arbol";
    let ids = []; 
    appData.categories.forEach(cat => { 
        cat.items.forEach(it => { 
            const tLabel = it.type === 'cuantitativa' ? '(Valor Numérico)' : '(Grado Ordinal)';
            csv += `,${cat.name}-${it.name}(Presencia),${cat.name}-${it.name}${tLabel}`; 
            ids.push(it.id); 
        }); 
    }); 
    csv += "\n";
    evals.forEach(ev => {
        const zoneName = appData.zones.find(z=>z.id === ev.zoneId)?.name || 'Fuera de sectores';
        let treeTypeName = 'No especificado';
        if(ev.treeTypeId && appData.treeTypes) {
            treeTypeName = appData.treeTypes.find(t=>t.id === ev.treeTypeId)?.name || 'Desconocido';
        }

        let row = [ev.id, new Date(ev.timestamp).toLocaleString().replace(/,/g,''), ev.lat, ev.lng, zoneName, treeTypeName];
        ids.forEach(id => { 
            row.push(ev.data[id] && ev.data[id].presence ? "SI" : "NO"); 
            row.push(ev.data[id] && ev.data[id].severity ? ev.data[id].severity : "0"); 
        });
        csv += row.join(",") + "\n";
    });
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csv)); link.setAttribute("download", `AgriScout_Crudo_${new Date().toISOString().split('T')[0]}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function exportTableToCSV() {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer.innerHTML.includes('<table')) return showToast("No hay tabla para exportar");

    let csv = "data:text/csv;charset=utf-8,";
    
    const tables = tableContainer.querySelectorAll('table');
    
    tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            let rowData = [];
            const cols = row.querySelectorAll('td, th');
            cols.forEach(col => {
                let text = col.innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""');
                rowData.push(`"${text}"`);
            });
            csv += rowData.join(",") + "\n";
        });
        csv += "\n\n";
    });

    const link = document.createElement("a"); 
    link.setAttribute("href", encodeURI(csv)); 
    link.setAttribute("download", `AgriScout_Historico_${new Date().toISOString().split('T')[0]}.csv`); 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}

function resetAppData() { if(confirm("¡Borrará TODOS los datos!")) { localStorage.removeItem('agriScoutData'); location.reload(); } }

window.onload = () => { loadData(); initMap(); };