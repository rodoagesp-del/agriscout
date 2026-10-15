// =========================================================
// REPORTS - Tablas históricas, gráficas y exportaciones
// =========================================================

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

    if (currentReportView === 'chart') generateChartReport();
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
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

    [btnVis, btnTab, btnChart].forEach(btn => {
        btn.className = "flex-1 py-2 font-bold rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 text-sm";
    });

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

    let titleText = `Filtro: ${zoneId === 'all' ? 'Todos los sectores' : (appData.zones.find(z => z.id === zoneId)?.name)}`;
    if (appData.treeTypes && appData.treeTypes.length > 0 && treeTypeId !== 'all') {
        const ttName = treeTypeId === 'none' ? 'Sin variedad' : appData.treeTypes.find(t => t.id === treeTypeId)?.name;
        titleText += ` | Variedad: ${ttName}`;
    }
    const dStart = document.getElementById('reportDateStart').value;
    const dEnd = document.getElementById('reportDateEnd').value;
    if (dStart || dEnd) titleText += ` | Fechas: ${dStart || 'Inicio'} a ${dEnd || 'Hoy'}`;

    document.getElementById('reportZoneTitle').textContent = titleText;

    if (!window.reportMapInstance) {
        window.reportMapInstance = L.map('reportMapContainer', {
            zoomControl: false, dragging: false, scrollWheelZoom: false
        }).setView([-12.0464, -77.0428], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(window.reportMapInstance);
        window.reportMapLayer = L.featureGroup().addTo(window.reportMapInstance);
    }
    window.reportMapLayer.clearLayers();

    let zonesToReport = zoneId === 'all'
        ? [...appData.zones, { id: 'unknown', name: 'Fuera de sectores dibujados' }]
        : [appData.zones.find(z => z.id === zoneId) || { id: 'unknown', name: 'Fuera de sectores' }];

    let evalsToPlot = getFilteredEvaluations();

    zonesToReport.forEach(z => {
        if (z.polygon && z.polygon.length > 2) {
            L.polygon(z.polygon, {
                color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 2
            }).addTo(window.reportMapLayer);
        }
    });
    evalsToPlot.forEach(ev => {
        if (ev.lat && ev.lng) {
            L.circleMarker([ev.lat, ev.lng], {
                color: '#ffffff', fillColor: '#ef4444', radius: 5, fillOpacity: 1, weight: 1
            }).addTo(window.reportMapLayer);
        }
    });

    setTimeout(() => {
        window.reportMapInstance.invalidateSize();
        if (window.reportMapLayer.getLayers().length > 0) {
            window.reportMapInstance.fitBounds(window.reportMapLayer.getBounds(), { padding: [15, 15] });
        }
    }, 300);

    let html = '';
    let totalGeneral = 0;

    zonesToReport.forEach(targetZone => {
        let evals = evalsToPlot.filter(e => e.zoneId === targetZone.id);

        if (evals.length === 0) return;
        totalGeneral += evals.length;

        html += `<div class="mb-8 border-4 border-emerald-600 rounded-xl p-4 bg-white shadow-md page-break-inside-avoid">`;
        html += `<h2 class="text-2xl font-black text-emerald-900 mb-4 bg-emerald-100 p-3 rounded-lg text-center uppercase tracking-widest">Sector: ${targetZone.name} <span class="text-sm normal-case font-bold text-emerald-700 ml-2">(${evals.length} árboles evaluados)</span></h2>`;

        appData.categories.forEach(cat => {
            if (cat.items.length === 0) return;
            html += `<div class="mb-6"><h3 class="text-lg font-bold text-slate-800 mb-3 border-b-2 border-emerald-400 pb-1 uppercase">${cat.name}</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;

            cat.items.forEach(item => {
                let pCount = 0;
                let sCounts = { '1': 0, '2': 0, '3': 0, '4': 0 };
                let sumQuant = 0;
                const isQuant = item.type === 'cuantitativa';

                evals.forEach(ev => {
                    if (ev.data[item.id] && ev.data[item.id].presence) {
                        pCount++;
                        if (isQuant) {
                            let val = parseFloat(ev.data[item.id].severity);
                            if (!isNaN(val)) sumQuant += val;
                        } else {
                            if (ev.data[item.id].severity && sCounts[ev.data[item.id].severity] !== undefined) sCounts[ev.data[item.id].severity]++;
                        }
                    }
                });

                const incPct = parseFloat(((pCount / evals.length) * 100).toFixed(1));

                let detailHTML = '';
                if (isQuant) {
                    let avg = pCount > 0 ? (sumQuant / pCount).toFixed(2) : 0;
                    let limitMessageHTML = '';

                    if (pCount > 0 && ((item.limitMin !== null && item.limitMin !== undefined) || (item.limitMax !== null && item.limitMax !== undefined))) {
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
                        if (v > max) {
                            max = v;
                            pred = item.labels && item.labels[k] ? item.labels[k] : "Nivel " + k;
                        }
                    }

                    let boxesHTML = '';
                    const colors = [
                        { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
                        { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
                        { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
                        { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' }
                    ];
                    for (let i = 1; i <= 4; i++) {
                        const c = colors[i - 1];
                        const labelText = item.labels && item.labels[i] ? item.labels[i] : 'Nivel ' + i;
                        boxesHTML += `
                            <div class="flex-1 flex flex-col justify-center ${c.bg} ${c.text} py-2 rounded border ${c.border} shadow-sm px-1" title="${labelText}">
                                <span class="text-[10px] font-black mb-1 truncate leading-tight">${labelText}</span>
                                <span class="text-sm font-bold bg-white/50 rounded-full w-6 h-6 mx-auto flex items-center justify-center">${sCounts[i]}</span>
                            </div>`;
                    }

                    let limitMessageHTML = '';
                    if (pCount > 0 && ((item.limitMin !== null && item.limitMin !== undefined) || (item.limitMax !== null && item.limitMax !== undefined))) {
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
                            <div class="flex gap-1 text-center font-bold">
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

    for (const zId in grouped) {
        const zoneName = appData.zones.find(z => z.id === zId)?.name || 'Fuera de sectores';

        for (const tId in grouped[zId]) {
            let treeTypeName = "";
            if (diffTreeType) {
                treeTypeName = tId === 'none' ? 'Sin Variedad' : (appData.treeTypes.find(t => t.id === tId)?.name || 'Desconocido');
            }

            const titleHeader = diffTreeType ? `${zoneName} <span class="text-blue-200">| Variedad: ${treeTypeName}</span>` : zoneName;

            html += `<div class="mb-8">`;
            html += `<table class="w-full text-sm text-left whitespace-nowrap">`;

            html += `<thead class="text-xs uppercase bg-slate-800 text-white">`;

            html += `<tr>`;
            html += `<th rowspan="2" class="px-4 py-3 border border-slate-700 bg-slate-900 text-base min-w-[120px] sticky left-0 z-10">${titleHeader} <br><span class="text-[10px] text-slate-400 font-normal normal-case">(Ordenado de antiguo a reciente)</span></th>`;

            appData.categories.forEach(cat => {
                if (cat.items.length > 0) {
                    html += `<th colspan="${cat.items.length}" class="px-4 py-2 border border-slate-700 text-center bg-emerald-700">${cat.name}</th>`;
                }
            });
            html += `</tr>`;

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

            html += `<tbody>`;

            let dates = Object.keys(grouped[zId][tId]).sort((a, b) => new Date(a) - new Date(b));

            dates.forEach(date => {
                const dayEvals = grouped[zId][tId][date];
                const dateFormatted = date.split('-').reverse().join('/');

                html += `<tr class="bg-white border-b hover:bg-emerald-50">`;
                html += `<td class="px-4 py-3 border border-slate-200 font-bold text-slate-700 sticky left-0 bg-white z-10">${dateFormatted} <span class="text-xs font-normal text-slate-400 ml-1">(n=${dayEvals.length})</span></td>`;

                appData.categories.forEach(cat => {
                    cat.items.forEach(item => {
                        let pCount = 0;
                        let sumQuant = 0;
                        const isQuant = item.type === 'cuantitativa';

                        dayEvals.forEach(ev => {
                            if (ev.data[item.id] && ev.data[item.id].presence) {
                                pCount++;
                                if (isQuant) {
                                    let val = parseFloat(ev.data[item.id].severity);
                                    if (!isNaN(val)) sumQuant += val;
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

    if (!catId || !itemId) return;

    const cat = appData.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    if (!item) return;

    const isQuant = item.type === 'cuantitativa';
    let evals = getFilteredEvaluations();

    const chartNoData = document.getElementById('chartNoDataMsg');
    const canvasContainer = document.getElementById('evolutionChart').parentElement;

    if (evals.length === 0) {
        chartNoData.classList.remove('hidden');
        canvasContainer.classList.add('hidden');
        return;
    }

    let groupedByWeek = {};

    evals.forEach(ev => {
        const date = new Date(ev.timestamp);
        const [year, weekNum] = getWeekNumber(date);
        const weekKey = `${year} - Sem ${weekNum}`;

        if (!groupedByWeek[weekKey]) {
            const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            groupedByWeek[weekKey] = { evals: [], label: `Sem ${weekNum}\n(${dateStr})`, sortKey: date.getTime() };
        }
        groupedByWeek[weekKey].evals.push(ev);
    });

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

    sortedWeeks.forEach(weekData => {
        let pCount = 0;
        let sumQuant = 0;

        weekData.evals.forEach(ev => {
            if (ev.data[itemId] && ev.data[itemId].presence) {
                pCount++;
                if (isQuant) {
                    let val = parseFloat(ev.data[itemId].severity);
                    if (!isNaN(val)) sumQuant += val;
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

    const zoneName = zoneId === 'all' ? 'Todos los sectores' : (appData.zones.find(z => z.id === zoneId)?.name || 'Sector');
    document.getElementById('chartTitle').textContent = `Evolución: ${item.name}`;
    document.getElementById('chartSubtitle').textContent = `${zoneName} | ${isQuant ? 'Promedio Numérico' : '% Incidencia de Afectados'}`;

    if (chartInstance) {
        chartInstance.destroy();
    }

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
    html2pdf().set({
        margin: 10,
        filename: 'AgriScout_Reporte.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(document.getElementById('reportContent')).save();
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
        margin: 10,
        filename: `AgriScout_Tabla_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        },
        jsPDF: {
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
    if (evals.length === 0) return showToast("No hay datos para exportar");
    let csv = "data:text/csv;charset=utf-8,ID_Evaluacion,Fecha,Latitud,Longitud,Sector,Variedad_Arbol";
    let ids = [];
    appData.categories.forEach(cat => {
        cat.items.forEach(it => {
            const tLabel = it.type === 'cuantitativa' ? '(Valor Numérico)' : '(Grado 1-4)';
            csv += `,${cat.name}-${it.name}(Presencia),${cat.name}-${it.name}${tLabel}`;
            ids.push(it.id);
        });
    });
    csv += "\n";
    evals.forEach(ev => {
        const zoneName = appData.zones.find(z => z.id === ev.zoneId)?.name || 'Fuera de sectores';
        let treeTypeName = 'No especificado';
        if (ev.treeTypeId && appData.treeTypes) {
            treeTypeName = appData.treeTypes.find(t => t.id === ev.treeTypeId)?.name || 'Desconocido';
        }

        let row = [ev.id, new Date(ev.timestamp).toLocaleString().replace(/,/g, ''), ev.lat, ev.lng, zoneName, treeTypeName];
        ids.forEach(id => {
            row.push(ev.data[id] && ev.data[id].presence ? "SI" : "NO");
            row.push(ev.data[id] && ev.data[id].severity ? ev.data[id].severity : "0");
        });
        csv += row.join(",") + "\n";
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", `AgriScout_Crudo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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