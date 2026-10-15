// =========================================================
// CONFIG - Categorías, viñetas y tipos de árbol
// =========================================================

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
        if (!appData.treeTypes) appData.treeTypes = [];
        appData.treeTypes.push({ id: 'tt_' + Date.now(), name: name });
        saveData();
        document.getElementById('newTreeTypeName').value = '';
        renderTreeTypes();
    }
}

function deleteTreeType(id) {
    if (confirm("¿Eliminar este tipo de árbol? Las evaluaciones previas mantendrán el dato, pero no podrás elegirlo de nuevo.")) {
        appData.treeTypes = appData.treeTypes.filter(t => t.id !== id);
        saveData();
        renderTreeTypes();
    }
}

// --- CONFIG (CATEGORIAS) ---
function renderCategories() {
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';
    appData.categories.forEach(cat => {
        let itemsHTML = cat.items.map(item => {
            let labelsHTML = '';
            if (item.type === 'ordinal' && item.labels) {
                labelsHTML = `
                    <div class="mt-2 bg-white p-2 rounded text-xs border border-slate-200 shadow-sm">
                        <p class="font-bold text-slate-500 mb-1 text-[10px] uppercase">Significado de los niveles:</p>
                        <div class="flex flex-col gap-1">
                            <div class="flex items-center gap-2"><span class="font-bold text-emerald-600 w-3">1:</span><input type="text" value="${item.labels[1] || ''}" onchange="updateItemLabel('${cat.id}', '${item.id}', 1, this.value)" class="border rounded px-2 py-1 flex-1 bg-slate-50 outline-none focus:ring-1 focus:ring-emerald-500"></div>
                            <div class="flex items-center gap-2"><span class="font-bold text-emerald-600 w-3">2:</span><input type="text" value="${item.labels[2] || ''}" onchange="updateItemLabel('${cat.id}', '${item.id}', 2, this.value)" class="border rounded px-2 py-1 flex-1 bg-slate-50 outline-none focus:ring-1 focus:ring-emerald-500"></div>
                            <div class="flex items-center gap-2"><span class="font-bold text-emerald-600 w-3">3:</span><input type="text" value="${item.labels[3] || ''}" onchange="updateItemLabel('${cat.id}', '${item.id}', 3, this.value)" class="border rounded px-2 py-1 flex-1 bg-slate-50 outline-none focus:ring-1 focus:ring-emerald-500"></div>
                            <div class="flex items-center gap-2"><span class="font-bold text-emerald-600 w-3">4:</span><input type="text" value="${item.labels[4] || ''}" onchange="updateItemLabel('${cat.id}', '${item.id}', 4, this.value)" class="border rounded px-2 py-1 flex-1 bg-slate-50 outline-none focus:ring-1 focus:ring-emerald-500"></div>
                        </div>
                    </div>
                `;
            }

            const lMin = item.limitMin !== undefined && item.limitMin !== null ? item.limitMin : '';
            const lMax = item.limitMax !== undefined && item.limitMax !== null ? item.limitMax : '';

            return `
            <div class="flex flex-col py-3 px-3 bg-slate-50 border-b">
                <div class="flex justify-between items-center w-full mb-1">
                    <div>
                        <span class="font-bold text-slate-700">${item.name}</span>
                        <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-2 uppercase font-bold tracking-wider">${item.type === 'cuantitativa' ? 'Valor numérico' : 'Niveles 1-4'}</span>
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

                ${labelsHTML}
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
                            <option value="ordinal">Niveles (1 al 4)</option>
                            <option value="cuantitativa">Numérico (%)</option>
                        </select>
                        <button class="bg-slate-800 text-white px-3 rounded font-bold hover:bg-slate-700" onclick="addItem('${cat.id}')">Add</button>
                    </div>
                </div>
            </div>`;
    });
}

function addCategory() {
    const name = document.getElementById('newCatName').value.trim();
    if (name) {
        appData.categories.push({ id: 'cat_' + Date.now(), name: name, items: [] });
        saveData();
        document.getElementById('newCatName').value = '';
        renderCategories();
    }
}

function deleteCategory(id) {
    if (confirm("¿Eliminar categoría?")) {
        appData.categories = appData.categories.filter(c => c.id !== id);
        saveData();
        renderCategories();
    }
}

function addItem(catId) {
    const name = document.getElementById(`newItem_${catId}`).value.trim();
    const type = document.getElementById(`newType_${catId}`).value;
    if (name) {
        let newItem = { id: 'it_' + Date.now(), name: name, type: type, limitMin: null, limitMax: null };
        if (type === 'ordinal') {
            newItem.labels = { 1: 'Nivel 1', 2: 'Nivel 2', 3: 'Nivel 3', 4: 'Nivel 4' };
        }
        appData.categories.find(c => c.id === catId).items.push(newItem);
        saveData();
        renderCategories();
    }
}

function deleteItem(catId, itemId) {
    if (confirm("¿Eliminar viñeta?")) {
        const cat = appData.categories.find(c => c.id === catId);
        cat.items = cat.items.filter(i => i.id !== itemId);
        saveData();
        renderCategories();
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