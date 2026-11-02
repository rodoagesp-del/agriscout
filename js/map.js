// =========================================================
// MAP & GPS - Leaflet, geolocalización y dibujo de zonas
// =========================================================

function initMap() {
    // Definir capas base
    const mapaNormal = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    const mapaSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' });

    // Iniciar mapa con satélite por defecto
    map = L.map('map', {
        layers: [mapaSatelite] 
    }).setView([-12.0464, -77.0428], 13);

    // Control para alternar capas
    const baseMaps = {
        "Vista Satélite": mapaSatelite,
        "Mapa Normal (Calles)": mapaNormal
    };
    L.control.layers(baseMaps).addTo(map);

    map.addLayer(drawnItems);
    map.addLayer(drawingMarkers);
    renderZonesOnMap();
    startGPS();
}

function startGPS() {
    const statusEl = document.getElementById('gpsStatus');
    document.getElementById('retryGpsBtn').classList.add('hidden');
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    acc: position.coords.accuracy
                };
                document.getElementById('centerMapBtn').classList.remove('hidden');

                if (!userMarker) {
                    userMarker = L.circleMarker([currentLocation.lat, currentLocation.lng], {
                        color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, radius: 8
                    }).addTo(map).bindPopup('<b>📍 Tu Ubicación Actual</b>');

                    if (appData.zones.length === 0 && appData.evaluations.length === 0) {
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

function centerMapOnUser() {
    if (currentLocation && map) map.setView([currentLocation.lat, currentLocation.lng], 18);
}

function renderZonesOnMap() {
    drawnItems.clearLayers();
    const listEl = document.getElementById('zonesList');
    listEl.innerHTML = '';

    appData.zones.forEach(zone => {
        if (zone.polygon && zone.polygon.length > 2) {
            // ✅ MODIFICADO: Se añade zoneId al options para poder encontrarlo después
            L.polygon(zone.polygon, {
                color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 3, zoneId: zone.id
            }).addTo(drawnItems).bindPopup(`<b>Sector: ${zone.name}</b>`);
        }

        // ✅ MODIFICADO: Se añade botón de editar junto al de eliminar
        listEl.innerHTML += `
        <li class="py-3 flex justify-between items-center border-b last:border-0">
            <div class="flex flex-col">
                <span class="font-bold text-slate-700">${zone.name}</span>
                <span class="text-xs text-slate-500"><i class="fa-solid fa-tree text-emerald-500"></i> ${zone.totalTrees || 0} árboles totales</span>
            </div>
            <div class="flex gap-2">
                <button onclick="toggleEditZone('${zone.id}', this)" class="text-blue-500 hover:bg-blue-50 p-2 rounded transition" title="Editar vértices"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteZone('${zone.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Eliminar sector"><i class="fa-solid fa-trash"></i></button>
            </div>
        </li>`;
    });

    if (appData.evaluations && appData.evaluations.length > 0) {
        appData.evaluations.forEach(ev => {
            if (ev.lat && ev.lng) {
                L.circleMarker([ev.lat, ev.lng], {
                    color: '#ffffff', fillColor: '#ef4444', radius: 6, fillOpacity: 1, weight: 2
                }).addTo(drawnItems).bindPopup('<b>🌳 Árbol Evaluado</b>');
            }
        });
    }

    if (drawnItems.getLayers().length > 0) {
        setTimeout(() => { map.fitBounds(drawnItems.getBounds(), { padding: [20, 20] }); }, 200);
    }
}

function startDrawingZone() {
    document.getElementById('startDrawingBtn').classList.add('hidden');
    document.getElementById('drawingControls').classList.remove('hidden');
    document.getElementById('drawingControls').classList.add('flex');
    currentDrawingPoints = [];
    drawingMarkers.clearLayers();
    if (drawingPolygonLine) map.removeLayer(drawingPolygonLine);
    centerMapOnUser();
    showToast("Camine por el borde y añada puntos GPS");
}

function addPointToZone() {
    if (!currentLocation) return showToast("Esperando GPS...");
    const pt = [currentLocation.lat, currentLocation.lng];
    currentDrawingPoints.push(pt);
    L.circleMarker(pt, { color: 'red', radius: 4, fillOpacity: 1 }).addTo(drawingMarkers);
    if (drawingPolygonLine) map.removeLayer(drawingPolygonLine);

    if (currentDrawingPoints.length > 2) {
        drawingPolygonLine = L.polygon(currentDrawingPoints, {
            color: '#f59e0b', fillColor: '#fcd34d', fillOpacity: 0.4
        }).addTo(map);
    } else if (currentDrawingPoints.length > 0) {
        drawingPolygonLine = L.polyline(currentDrawingPoints, {
            color: '#f59e0b', dashArray: '5, 5'
        }).addTo(map);
    }
    centerMapOnUser();
    showToast(`Punto ${currentDrawingPoints.length} guardado`);
}

function cancelDrawing() {
    document.getElementById('startDrawingBtn').classList.remove('hidden');
    document.getElementById('drawingControls').classList.add('hidden');
    document.getElementById('drawingControls').classList.remove('flex');
    document.getElementById('newZoneName').value = '';
    document.getElementById('newZoneTrees').value = '';
    if (drawingPolygonLine) map.removeLayer(drawingPolygonLine);
    drawingMarkers.clearLayers();
    currentDrawingPoints = [];
}

function saveZone() {
    const name = document.getElementById('newZoneName').value.trim();
    const trees = parseInt(document.getElementById('newZoneTrees').value);
    if (!name) return showToast("Falta nombre del sector");
    if (!trees || trees <= 0) return showToast("Ingrese un número válido de árboles");
    if (currentDrawingPoints.length < 3) return showToast("Mínimo 3 puntos GPS para un área");

    appData.zones.push({
        id: 'zone_' + Date.now(),
        name: name,
        totalTrees: trees,
        polygon: currentDrawingPoints
    });
    saveData();
    cancelDrawing();
    renderZonesOnMap();
    showToast("Sector guardado");
}

function deleteZone(id) {
    if (confirm("¿Eliminar sector?")) {
        appData.zones = appData.zones.filter(z => z.id !== id);
        saveData();
        renderZonesOnMap();
    }
}

// ✅ NUEVA FUNCIÓN: Maneja la edición de vértices de zonas
function toggleEditZone(id, btnElement) {
    const layer = drawnItems.getLayers().find(l => l.options.zoneId === id);
    if (!layer) return;

    if (layer.pm.enabled()) {
        // Desactivar edición y guardar
        layer.pm.disable();
        const newCoords = layer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]);
        const zoneIndex = appData.zones.findIndex(z => z.id === id);
        if (zoneIndex > -1) {
            appData.zones[zoneIndex].polygon = newCoords;
            saveData();
            showToast("✅ Sector actualizado");
        }
        btnElement.classList.replace('text-green-500', 'text-blue-500');
        btnElement.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
    } else {
        // Activar edición
        layer.pm.enable({ allowSelfIntersection: false });
        btnElement.classList.replace('text-blue-500', 'text-green-500');
        btnElement.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
        showToast("Arrastra los vértices blancos para editar y presiona guardar");
    }
}