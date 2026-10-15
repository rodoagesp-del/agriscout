// =========================================================
// EVALUATION - Checklist de campo y guardado de árboles
// =========================================================

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
    if (!currentLocation) return showToast("Esperando señal GPS para ubicar el árbol...");

    const zone = appData.zones.find(z => isPointInPolygon([currentLocation.lat, currentLocation.lng], z.polygon));

    currentEvaluation = {
        id: 'eval_' + Date.now(),
        timestamp: new Date().toISOString(),
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        zoneId: zone ? zone.id : 'unknown',
        treeTypeId: null,
        data: {}
    };

    document.getElementById('evalStartScreen').classList.add('hidden');
    document.getElementById('evaluationForm').classList.remove('hidden');
    document.getElementById('evalZoneName').innerHTML = zone
        ? `Sector: <span class="text-emerald-600 font-black">${zone.name}</span>`
        : '<span class="text-red-500 font-bold">Fuera de los sectores</span>';
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
            <div class="w-full bg-blue-200 rounded-full h-2 mb-2"><div class="bg-blue-600 h-2 rounded-full" style="width: ${Math.min((evalsDone / minReq) * 100, 100)}%"></div></div>
            <p class="text-[11px] font-bold text-blue-700 italic"><i class="fa-solid fa-person-walking mr-1"></i>¡Camina! Toma muestras de árboles separados para que sea representativo. (Óptimo 5%: ${optReq} árboles).</p>
        `;
    } else {
        statsContainer.classList.add('hidden');
    }

    renderEvaluationForm();
}

function renderEvaluationForm() {
    const container = document.getElementById('evalCategoriesContainer');
    container.innerHTML = '';
    appData.categories.forEach(cat => {
        let itemsHTML = cat.items.map(item => {
            const isQuantitative = item.type === 'cuantitativa';
            let inputField = '';

            if (isQuantitative) {
                inputField = `<label class="text-xs text-blue-800 font-bold mb-1 block uppercase">Ingrese Valor Numérico:</label>
                 <input type="number" step="0.01" class="w-full border border-blue-300 p-2 rounded font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej. 15.5" oninput="setSeverity('${item.id}', this.value)">`;
            } else {
                const l1 = item.labels?.[1] || 'Nivel 1';
                const l2 = item.labels?.[2] || 'Nivel 2';
                const l3 = item.labels?.[3] || 'Nivel 3';
                const l4 = item.labels?.[4] || 'Nivel 4';

                inputField = `
                 <label class="text-xs text-emerald-800 font-bold mb-1 block uppercase">Intensidad (1 al 4):</label>
                 <select class="w-full border border-gray-300 p-2 rounded font-bold outline-none text-sm" onchange="setSeverity('${item.id}', this.value)">
                    <option value="1">1 - ${l1}</option>
                    <option value="2">2 - ${l2}</option>
                    <option value="3">3 - ${l3}</option>
                    <option value="4">4 - ${l4}</option>
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
    if (!currentEvaluation.data[itemId]) currentEvaluation.data[itemId] = {};
    const bAus = document.getElementById(`btn_ausencia_${itemId}`),
          bPre = document.getElementById(`btn_presencia_${itemId}`);
    const sCont = document.getElementById(`severity_container_${itemId}`);
    if (isPresent) {
        bAus.className = "px-4 py-2 text-sm font-bold rounded text-slate-500 hover:bg-gray-200 w-full";
        bPre.className = "px-4 py-2 text-sm font-bold rounded bg-emerald-600 shadow-sm text-white w-full";
        sCont.classList.remove('hidden');
        currentEvaluation.data[itemId].presence = true;
        const inputEl = sCont.querySelector('select, input');
        currentEvaluation.data[itemId].severity = inputEl.value || null;
    } else {
        bPre.className = "px-4 py-2 text-sm font-bold rounded text-slate-500 hover:bg-gray-200 w-full";
        bAus.className = "px-4 py-2 text-sm font-bold rounded bg-white shadow-sm text-slate-800 w-full";
        sCont.classList.add('hidden');
        currentEvaluation.data[itemId].presence = false;
        currentEvaluation.data[itemId].severity = null;
    }
}

function setSeverity(itemId, level) {
    if (!currentEvaluation.data[itemId]) currentEvaluation.data[itemId] = { presence: true };
    currentEvaluation.data[itemId].severity = level;
}

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

    appData.categories.forEach(cat => {
        cat.items.forEach(item => {
            if (!currentEvaluation.data[item.id] || currentEvaluation.data[item.id].presence === undefined) {
                currentEvaluation.data[item.id] = { presence: false, severity: null };
            }
        });
    });
    appData.evaluations.push(currentEvaluation);
    saveData();
    showToast("✅ Árbol guardado correctamente en su sector");
    cancelEvaluation();
}