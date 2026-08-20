// ==================== GLOBAL STATE ====================
const API_BASE_URL = 'https://makinfratech-api.onrender.com/api';
const token = localStorage.getItem('fsm_token');
let userRole = (localStorage.getItem('fsm_role') || 'SUPER_ADMIN').toUpperCase();
let selectedInvoiceTemplate = localStorage.getItem('invoice_template') || 'modern';
let editingInvoiceId = null;
let signaturePad = null;
let companyImageData = { logo: null, header: null, footer: null };
let staffPhotoData = null;
let purchaseReceiptData = null;
let allWoBuildings = [], allWoFlats = [];
let allInvBuildings = [], allInvFlats = [];

// ==================== API HELPER ====================
async function apiFetch(endpoint, method = 'GET', body = null) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
        },
        body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'API Error' }));
        throw new Error(err.message || `HTTP ${res.status} Error`);
    }
    return res.json();
}

async function fetchAndRender(endpoint, tableId, columns) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${columns.length}" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch(endpoint);
        if (!Array.isArray(data) || data.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="${columns.length}" class="p-6 text-center text-gray-500">No data found.</td></tr>`; 
            return; 
        }
        tbody.innerHTML = data.map(item => `<tr>${columns.map(col => {
            let val = item; 
            col.split('.').forEach(part => { val = val ? val[part] : null; });
            return `<td class="px-4 py-3 text-sm text-gray-700">${val !== null && val !== undefined ? val : '-'}</td>`;
        }).join('')}</tr>`).join('');
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="${columns.length}" class="p-6 text-center text-red-500">Failed to load data.</td></tr>`; 
    }
}

async function fetchDropdown(endpoint) {
    try { 
        const data = await apiFetch(endpoint); 
        if (!Array.isArray(data)) return '<option value="">No options available</option>';
        return data.map(item => `<option value="${item.id}">${item.name || item.title || item.email || item.poNumber || item.sku || item.contractNumber || item.invoiceNumber}</option>`).join(''); 
    } catch (e) { 
        return '<option value="">Error loading options</option>'; 
    }
}

function numberToWords(num) {
    const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    if ((num = num.toString()).length > 9) return 'Overflow';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; var str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only ' : '';
    return str;
}

// ==================== MODAL LOGIC ====================
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalFields = document.getElementById('modal-fields');
const modalForm = document.getElementById('modal-form');
const modalError = document.getElementById('modal-error');
const modalSubmitBtn = document.getElementById('modal-submit-btn');

function openModal(title, fieldsHtml, isViewOnly = false) {
    if (!modal) return;
    if (modalTitle) modalTitle.innerText = title;
    if (modalFields) modalFields.innerHTML = fieldsHtml;
    modal.classList.add('active');
    if (modalSubmitBtn) modalSubmitBtn.style.display = isViewOnly ? 'none' : 'block';
}

function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    if (modalForm) modalForm.reset();
    if (modalError) modalError.classList.add('hidden');
    const mb = document.querySelector('#modal > div');
    if (mb) {
        mb.classList.add('max-w-md');
        mb.classList.remove('max-w-5xl', 'max-w-2xl', 'max-w-3xl', 'max-w-sm', 'p-0');
    }
}

async function handleSubmit(endpoint, data, successMsg, refreshPage, method = 'POST') {
    if (modalSubmitBtn) modalSubmitBtn.innerText = 'Saving...';
    if (modalError) modalError.classList.add('hidden');
    try {
        await apiFetch(endpoint, method, data);
        closeModal();
        alert(successMsg);
        if (refreshPage) {
            const handlers = { 
                'tbody-work-orders': fetchAndRenderWorkOrders, 
                'tbody-invoices': fetchAndRenderInvoices, 
                'tbody-inventory': fetchAndRenderAssets, 
                'tbody-buildings': fetchAndRenderBuildings,
                'tbody-staff': fetchAndRenderStaff, 
                'tbody-purchases': fetchAndRenderPurchases, 
                'tbody-receipts': fetchAndRenderReceipts, 
                'tbody-payments': fetchAndRenderPayments, 
                'tbody-users': fetchAndRenderUsers, 
                'tbody-flats': fetchAndRenderFlats 
            };
            if (handlers[refreshPage.tableId]) handlers[refreshPage.tableId]();
            else fetchAndRender(refreshPage.endpoint, refreshPage.tableId, refreshPage.columns);
        }
    } catch (error) {
        if (modalError) {
            modalError.innerText = error.message;
            modalError.classList.remove('hidden');
        }
    } finally {
        if (modalSubmitBtn) modalSubmitBtn.innerText = 'Save';
    }
}

function getInput(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function toggleSidebar() { const el = document.getElementById('sidebar'); if (el) el.classList.toggle('-translate-x-full'); }
function logout() { localStorage.removeItem('fsm_token'); localStorage.removeItem('fsm_role'); window.location.href = 'login.html'; }

// ==================== WORK ORDERS & SERVICE REPORTS ====================
async function fetchAndRenderWorkOrders() {
    const tbody = document.getElementById('tbody-work-orders'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/work-orders');
        if (!Array.isArray(data) || data.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-500">No Work Orders found.</td></tr>`; return; }
        tbody.innerHTML = data.map(item => {
            const sc = { 'PENDING':'bg-yellow-100 text-yellow-700','ASSIGNED':'bg-blue-100 text-blue-700','IN_PROGRESS':'bg-amber-100 text-amber-700','PENDING_PARTS':'bg-orange-100 text-orange-700','COMPLETED':'bg-green-100 text-green-700','CANCELLED':'bg-red-100 text-red-700' };
            const s = item.status || 'PENDING';
            const cm = ['SUPER_ADMIN','ADMIN','MANAGER','COORDINATOR'].includes(userRole);
            return `<tr>
                <td class="px-4 py-3 text-sm font-medium">
                    <button onclick="openServiceReportModal('${item.id}')" class="text-blue-600 hover:text-blue-800 font-semibold underline hover:no-underline cursor-pointer">${item.woNumber}</button>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">${item.customer?.name||'-'}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${item.building?.name||'-'} ${item.flat?.unitNumber?'('+item.flat.unitNumber+')':''}</td>
                <td class="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">${item.description||item.title}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${item.scheduledDate?new Date(item.scheduledDate).toLocaleString():'N/A'}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${item.technician?.name||'Unassigned'}</td>
                <td class="px-4 py-3"><select onchange="updateWoStatus('${item.id}',this.value)" class="px-2 py-1 bg-white border border-gray-300 rounded-md text-xs ${sc[s]||''}"><option value="PENDING" ${s==='PENDING'?'selected':''}>Pending</option><option value="ASSIGNED" ${s==='ASSIGNED'?'selected':''}>Scheduled</option><option value="IN_PROGRESS" ${s==='IN_PROGRESS'?'selected':''}>In Progress</option><option value="PENDING_PARTS" ${s==='PENDING_PARTS'?'selected':''}>Pending Parts</option><option value="COMPLETED" ${s==='COMPLETED'?'selected':''}>Completed</option><option value="CANCELLED" ${s==='CANCELLED'?'selected':''}>Cancelled</option></select></td>
                <td class="px-4 py-3 text-sm flex gap-1">
                    <button onclick="openServiceReportModal('${item.id}')" class="text-purple-600 hover:text-purple-800 px-1 font-medium">Report</button>
                    ${cm?`<button onclick="deleteWo('${item.id}')" class="text-red-600 hover:text-red-800 px-1">Del</button>`:''}
                </td>
            </tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500">Failed to load data.</td></tr>`; }
}

async function updateWoStatus(id, status) { try { await apiFetch(`/work-orders/${id}/status`, 'PATCH', { status }); fetchAndRenderWorkOrders(); } catch (e) { alert('Failed: ' + e.message); } }
async function deleteWo(id) { if (confirm('Delete this WO?')) { try { await apiFetch(`/work-orders/${id}`, 'DELETE'); fetchAndRenderWorkOrders(); } catch (e) { alert('Failed: ' + e.message); } } }

async function openServiceReportModal(workOrderId) {
    try {
        const wo = await apiFetch(`/work-orders/${workOrderId}`);
        const comp = await apiFetch('/company').catch(() => ({}));
        const mb = document.querySelector('#modal > div'); 
        if (mb) { mb.classList.remove('max-w-md'); mb.classList.add('max-w-3xl', 'p-0'); }

        const logoHtml = comp.logoUrl ? `<img src="${comp.logoUrl}" class="h-12 mb-2" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='block';"><h1 class="text-xl font-bold text-blue-800" style="display:none;">${comp.name || 'MAK INFRATECH'}</h1>` : `<h1 class="text-xl font-bold text-blue-800">${comp.name || 'MAK INFRATECH'}</h1>`;

        openModal('Service Report', `
            <div class="no-print sticky top-0 bg-slate-50 py-2 px-4 flex justify-end gap-2 z-10 border-b">
                <button onclick="window.print()" class="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900">Print</button>
                <button onclick="downloadServiceReportPDF('SR_${wo.woNumber}')" class="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">PDF</button>
                <button onclick="closeModal()" class="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600">Close</button>
            </div>
            <div id="print-area" class="a4-page p-8 space-y-4" style="min-height:500px;">
                <div class="flex justify-between items-start border-b pb-4">
                    <div>${logoHtml}<p class="text-xs text-gray-600">${comp.address||''}</p></div>
                    <div class="text-right">
                        <h2 class="text-xl font-bold uppercase text-blue-900">SERVICE REPORT</h2>
                        <p class="text-sm font-semibold">WO #: ${wo.woNumber}</p>
                        <p class="text-xs text-gray-500">Date: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded">
                    <div><strong>Customer:</strong> ${wo.customer?.name || 'N/A'}</div>
                    <div><strong>Building / Unit:</strong> ${wo.building?.name || 'N/A'} ${wo.flat?.unitNumber ? '(' + wo.flat.unitNumber + ')' : ''}</div>
                    <div><strong>Technician:</strong> ${wo.technician?.name || 'Unassigned'}</div>
                    <div><strong>Scheduled Date:</strong> ${wo.scheduledDate ? new Date(wo.scheduledDate).toLocaleString() : 'N/A'}</div>
                </div>

                <div class="text-sm">
                    <strong>Complaint / Issue Description:</strong>
                    <div class="p-2 border rounded bg-white text-gray-800 mt-1">${wo.description || wo.title || 'N/A'}</div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-medium mb-1">Started At</label><input type="datetime-local" id="sr_startedAt" class="dark-input" value="${wo.startedAt ? new Date(wo.startedAt).toISOString().slice(0,16) : ''}"></div>
                    <div><label class="block text-sm font-medium mb-1">Completed At</label><input type="datetime-local" id="sr_completedAt" class="dark-input" value="${wo.completedAt ? new Date(wo.completedAt).toISOString().slice(0,16) : ''}"></div>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">Work Performed *</label>
                    <textarea id="sr_workPerformed" rows="3" class="dark-input">${wo.workPerformed || ''}</textarea>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">Materials / Parts Used</label>
                    <textarea id="sr_materials" rows="2" class="dark-input">${typeof wo.materialsUsed === 'object' && wo.materialsUsed ? (wo.materialsUsed.items || '') : (wo.materialsUsed || '')}</textarea>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">Observations / Recommendations</label>
                    <textarea id="sr_observations" rows="2" class="dark-input">${wo.observations || ''}</textarea>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">Client Signature</label>
                    <div class="border-2 border-gray-300 rounded-lg p-2 bg-white inline-block">
                        <canvas id="signature-canvas" width="400" height="120" class="w-full"></canvas>
                    </div>
                    <div class="no-print mt-1">
                        <button type="button" onclick="clearSignature()" class="text-xs text-red-500 underline">Clear Signature</button>
                    </div>
                </div>

                <div class="no-print pt-4 border-t flex justify-end gap-3">
                    <button type="button" onclick="saveServiceReport('${wo.id}')" class="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700">Save Report</button>
                </div>
            </div>
        `, true);

        const canvas = document.getElementById('signature-canvas');
        if (canvas && typeof SignaturePad !== 'undefined') {
            signaturePad = new SignaturePad(canvas);
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio; 
            canvas.height = canvas.offsetHeight * ratio; 
            canvas.getContext("2d").scale(ratio, ratio);
            if (wo.clientSignature) {
                signaturePad.fromDataURL(wo.clientSignature);
            }
        }
    } catch (e) { alert('Failed to load Work Order Service Report'); }
}

function clearSignature() { if (signaturePad) signaturePad.clear(); }

async function saveServiceReport(workOrderId) {
    const sa = getInput('sr_startedAt'), ca = getInput('sr_completedAt'), wp = getInput('sr_workPerformed'), m = getInput('sr_materials'), o = getInput('sr_observations'), sd = (signaturePad && !signaturePad.isEmpty()) ? signaturePad.toDataURL() : null;
    if (!wp) { alert('Please enter work performed.'); return; }
    try {
        await apiFetch(`/work-orders/${workOrderId}`, 'PATCH', { 
            startedAt: sa || null, 
            completedAt: ca || null, 
            workPerformed: wp, 
            materialsUsed: { items: m }, 
            observations: o, 
            clientSignature: sd 
        });
        await apiFetch(`/work-orders/${workOrderId}/status`, 'PATCH', { status: 'COMPLETED' });
        alert('Service Report saved successfully!');
        fetchAndRenderWorkOrders();
    } catch (e) { alert('Failed: ' + e.message); }
}

function downloadServiceReportPDF(filename) { 
    const el = document.getElementById('print-area'); 
    if (typeof html2pdf !== 'undefined' && el) { 
        html2pdf().set({margin:5,filename:`${filename}.pdf`,image:{type:'jpeg',quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(el).save(); 
    } else { 
        alert('PDF generator library (html2pdf) not loaded.'); 
    } 
}

async function openWorkOrderModal(prefillDate) {
    const customers = await apiFetch('/customers').catch(() => []); 
    allWoBuildings = await apiFetch('/buildings').catch(() => []); 
    allWoFlats = await apiFetch('/flats').catch(() => []); 
    const techs = await apiFetch('/users').catch(() => []);
    
    const co = Array.isArray(customers) ? customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('') : '';
    const to = Array.isArray(techs) ? techs.map(t => `<option value="${t.id}">${t.name}</option>`).join('') : '';
    
    openModal('New Work Order', `
        <div><label class="block text-sm mb-1">Client *</label><select id="wo_customerId" required onchange="filterWoBuildings()" class="dark-input"><option value="">Select</option>${co}</select></div>
        <div><label class="block text-sm mb-1">Building *</label><select id="wo_buildingId" required onchange="filterWoFlats()" disabled class="dark-input"><option value="">Select Client First</option></select></div>
        <div><label class="block text-sm mb-1">Flat</label><select id="wo_flatId" disabled class="dark-input"><option value="">Select Building</option></select></div>
        <div><label class="block text-sm mb-1">Technician</label><select id="wo_technicianId" class="dark-input"><option value="">Unassigned</option>${to}</select></div>
        <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm mb-1">Date *</label><input type="date" id="wo_scheduledDate" required class="dark-input"></div>
            <div><label class="block text-sm mb-1">Time *</label><input type="time" id="wo_scheduledTime" required class="dark-input"></div>
        </div>
        <div><label class="block text-sm mb-1">Complaint *</label><textarea id="wo_complaint" required rows="3" class="dark-input"></textarea></div>
    `);
    const sd = document.getElementById('wo_scheduledDate');
    if (sd) sd.valueAsDate = prefillDate ? new Date(prefillDate) : new Date();
    if (modalForm) {
        modalForm.onsubmit = (e) => { 
            e.preventDefault(); 
            const dv = getInput('wo_scheduledDate'), tv = getInput('wo_scheduledTime'), sdt = new Date(`${dv}T${tv}`); 
            handleSubmit('/work-orders', { title: 'Service Request', description: getInput('wo_complaint'), customerId: getInput('wo_customerId'), buildingId: getInput('wo_buildingId'), flatId: getInput('wo_flatId')||null, technicianId: getInput('wo_technicianId')||null, scheduledDate: sdt, priority: 'MEDIUM' }, 'WO created!', { tableId: 'tbody-work-orders' }); 
        };
    }
}

function filterWoBuildings() { 
    const ci = getInput('wo_customerId'); 
    const bs = document.getElementById('wo_buildingId'); 
    const fs = document.getElementById('wo_flatId'); 
    if (!bs || !fs) return;
    fs.innerHTML = '<option value="">Select Building First</option>'; fs.disabled = true; 
    bs.innerHTML = '<option value="">Select Building</option>'; 
    if (ci && Array.isArray(allWoBuildings)) { 
        bs.disabled = false; 
        allWoBuildings.filter(b => b.customerId === ci).forEach(b => bs.innerHTML += `<option value="${b.id}">${b.name}</option>`); 
    } else { 
        bs.disabled = true; 
    } 
}

function filterWoFlats() { 
    const bi = getInput('wo_buildingId'); 
    const fs = document.getElementById('wo_flatId'); 
    if (!fs) return;
    fs.innerHTML = '<option value="">Select Flat</option>'; 
    if (bi && Array.isArray(allWoFlats)) { 
        fs.disabled = false; 
        allWoFlats.filter(f => f.buildingId === bi).forEach(f => fs.innerHTML += `<option value="${f.id}">${f.unitNumber}</option>`); 
    } else { 
        fs.disabled = true; 
    } 
}

// ==================== BUILDINGS (WITH EDIT) ====================
async function fetchAndRenderBuildings() {
    const tbody = document.getElementById('tbody-buildings'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/buildings');
        if (!Array.isArray(data) || data.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500">No Buildings found.</td></tr>`; 
            return; 
        }
        tbody.innerHTML = data.map(item => `<tr>
            <td class="px-4 py-3 text-sm font-medium text-gray-700">${item.name || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.customer?.name || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.location || item.address || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.flats ? item.flats.length : '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700 flex gap-2">
                <button onclick="editBuilding('${item.id}')" class="text-blue-600 hover:text-blue-800">Edit</button>
                <button onclick="deleteBuilding('${item.id}')" class="text-red-600 hover:text-red-800">Del</button>
            </td>
        </tr>`).join('');
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500">Failed to load buildings.</td></tr>`; 
    }
}

async function openBuildingModal(editId = null) {
    const co = await fetchDropdown('/customers');
    let bld = {};
    if (editId) {
        bld = await apiFetch(`/buildings/${editId}`).catch(() => ({}));
    }

    openModal(editId ? 'Edit Building' : 'New Building', `
        <div><label class="block text-sm mb-1">Building Name *</label><input type="text" id="bld_name" required class="dark-input" value="${bld.name || ''}"></div>
        <div><label class="block text-sm mb-1">Customer / Client *</label><select id="bld_customerId" required class="dark-input"><option value="">Select Customer</option>${co}</select></div>
        <div><label class="block text-sm mb-1">Location / Address</label><input type="text" id="bld_location" class="dark-input" value="${bld.location || bld.address || ''}"></div>
    `);

    const sel = document.getElementById('bld_customerId');
    if (sel && bld.customerId) sel.value = bld.customerId;

    if (modalForm) {
        modalForm.onsubmit = (e) => {
            e.preventDefault();
            const endpoint = editId ? `/buildings/${editId}` : '/buildings';
            const method = editId ? 'PATCH' : 'POST';
            handleSubmit(endpoint, {
                name: getInput('bld_name'),
                customerId: getInput('bld_customerId'),
                address: getInput('bld_location'),
                location: getInput('bld_location')
            }, editId ? 'Building updated!' : 'Building created!', { tableId: 'tbody-buildings' }, method);
        };
    }
}

function editBuilding(id) { openBuildingModal(id); }

async function deleteBuilding(id) {
    if (confirm('Are you sure you want to delete this building?')) {
        try {
            await apiFetch(`/buildings/${id}`, 'DELETE');
            fetchAndRenderBuildings();
        } catch (e) { alert('Failed: ' + e.message); }
    }
}

// ==================== FLATS (WITH EDIT) ====================
async function fetchAndRenderFlats() {
    const tbody = document.getElementById('tbody-flats'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/flats');
        if (!Array.isArray(data) || data.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500">No Flats found.</td></tr>`; return; }
        tbody.innerHTML = data.map(item => `<tr>
            <td class="px-4 py-3 text-sm font-medium text-gray-700">${item.unitNumber||'-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.building?.name||'-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.floor||'-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.type||'-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700 flex gap-2">
                <button onclick="editFlat('${item.id}')" class="text-blue-600 hover:text-blue-800">Edit</button>
                <button onclick="deleteFlat('${item.id}')" class="text-red-600 hover:text-red-800">Del</button>
            </td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500">Failed to load flats.</td></tr>`; }
}

async function openFlatModal(editId = null) {
    const bo = await fetchDropdown('/buildings');
    let fl = {};
    if (editId) {
        fl = await apiFetch(`/flats/${editId}`).catch(() => ({}));
    }

    openModal(editId ? 'Edit Flat' : 'New Flat', `
        <div><label class="block text-sm mb-1">Building *</label><select id="fl_buildingId" required class="dark-input"><option value="">Select Building</option>${bo}</select></div>
        <div><label class="block text-sm mb-1">Unit / Flat Number *</label><input type="text" id="fl_unitNumber" required class="dark-input" value="${fl.unitNumber || ''}"></div>
        <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm mb-1">Floor</label><input type="number" id="fl_floor" class="dark-input" value="${fl.floor !== undefined ? fl.floor : ''}"></div>
            <div><label class="block text-sm mb-1">Type</label><input type="text" id="fl_type" placeholder="e.g. 2BHK, Studio" class="dark-input" value="${fl.type || ''}"></div>
        </div>
    `);

    const sel = document.getElementById('fl_buildingId');
    if (sel && fl.buildingId) sel.value = fl.buildingId;

    if (modalForm) {
        modalForm.onsubmit = (e) => { 
            e.preventDefault(); 
            const floorVal = getInput('fl_floor');
            const endpoint = editId ? `/flats/${editId}` : '/flats';
            const method = editId ? 'PATCH' : 'POST';
            handleSubmit(endpoint, { 
                buildingId: getInput('fl_buildingId'), 
                unitNumber: getInput('fl_unitNumber'), 
                floor: floorVal !== '' ? parseInt(floorVal, 10) : null, 
                type: getInput('fl_type') 
            }, editId ? 'Flat updated!' : 'Flat created!', { tableId: 'tbody-flats' }, method); 
        };
    }
}

function editFlat(id) { openFlatModal(id); }

async function deleteFlat(id) {
    if (confirm('Are you sure you want to delete this flat?')) {
        try {
            await apiFetch(`/flats/${id}`, 'DELETE');
            fetchAndRenderFlats();
        } catch (e) { alert('Failed: ' + e.message); }
    }
}

// ==================== ASSETS / INVENTORY ====================
async function fetchAndRenderAssets() {
    const tbody = document.getElementById('tbody-inventory'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        let data;
        try { data = await apiFetch('/assets'); } catch (err) { data = await apiFetch('/inventory'); }

        if (!Array.isArray(data) || data.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-500">No Assets found.</td></tr>`; 
            return; 
        }
        tbody.innerHTML = data.map(item => {
            const code = item.sku || item.assetTag || item.itemCode || item.serialNumber || '-';
            const name = item.name || item.title || item.itemName || item.model || '-';
            const category = item.category || item.type || '-';
            const qty = item.quantity !== undefined ? item.quantity : (item.qty !== undefined ? item.qty : 1);
            const unit = item.unit || 'Pcs';
            const price = item.unitPrice !== undefined ? item.unitPrice : (item.cost !== undefined ? item.cost : 0);
            const loc = item.location || item.storeLocation || item.building?.name || '-';

            return `<tr>
                <td class="px-4 py-3 text-sm font-medium text-gray-700">${code}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${name}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${category}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${qty}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${unit}</td>
                <td class="px-4 py-3 text-sm text-gray-700">AED ${parseFloat(price).toFixed(2)}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${loc}</td>
                <td class="px-4 py-3 text-sm text-gray-700 flex gap-2">
                    <button onclick="editAsset('${item.id}')" class="text-blue-600 hover:text-blue-800">Edit</button>
                    <button onclick="deleteAsset('${item.id}')" class="text-red-600 hover:text-red-800">Del</button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500">Failed to load inventory assets.</td></tr>`; 
    }
}

async function openAssetModal(editId = null) {
    let ast = {};
    if (editId) {
        try { ast = await apiFetch(`/assets/${editId}`); } 
        catch (e) { ast = await apiFetch(`/inventory/${editId}`).catch(() => ({})); }
    }

    openModal(editId ? 'Edit Asset' : 'New Asset', `
        <div><label class="block text-sm mb-1">SKU / Asset Code *</label><input type="text" id="ast_sku" required class="dark-input" value="${ast.sku || ast.assetTag || ''}"></div>
        <div><label class="block text-sm mb-1">Name *</label><input type="text" id="ast_name" required class="dark-input" value="${ast.name || ast.title || ''}"></div>
        <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm mb-1">Category</label><input type="text" id="ast_category" class="dark-input" value="${ast.category || ''}"></div>
            <div><label class="block text-sm mb-1">Unit</label><input type="text" id="ast_unit" placeholder="e.g. Pcs, Box, Kg" class="dark-input" value="${ast.unit || ''}"></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm mb-1">Quantity</label><input type="number" id="ast_qty" value="${ast.quantity !== undefined ? ast.quantity : 1}" class="dark-input"></div>
            <div><label class="block text-sm mb-1">Unit Price (AED)</label><input type="number" step="0.01" id="ast_price" value="${ast.unitPrice !== undefined ? ast.unitPrice : '0.00'}" class="dark-input"></div>
        </div>
        <div><label class="block text-sm mb-1">Location / Warehouse</label><input type="text" id="ast_location" class="dark-input" value="${ast.location || ''}"></div>
    `);

    if (modalForm) {
        modalForm.onsubmit = async (e) => {
            e.preventDefault();
            const payload = {
                sku: getInput('ast_sku'),
                name: getInput('ast_name'),
                category: getInput('ast_category'),
                unit: getInput('ast_unit'),
                quantity: parseInt(getInput('ast_qty'), 10) || 0,
                unitPrice: parseFloat(getInput('ast_price')) || 0,
                location: getInput('ast_location')
            };
            const endpoint = editId ? `/assets/${editId}` : '/assets';
            const method = editId ? 'PATCH' : 'POST';
            handleSubmit(endpoint, payload, editId ? 'Asset updated!' : 'Asset added!', { tableId: 'tbody-inventory' }, method);
        };
    }
}

function editAsset(id) { openAssetModal(id); }

async function deleteAsset(id) {
    if (confirm('Delete this asset item?')) {
        try {
            await apiFetch(`/assets/${id}`, 'DELETE');
            fetchAndRenderAssets();
        } catch (e) { alert('Failed: ' + e.message); }
    }
}

// ==================== INVOICES ====================
async function fetchAndRenderInvoices() {
    fetchAndRender('/invoices', 'tbody-invoices', ['invoiceNumber', 'customer.name', 'issueDate', 'dueDate', 'total', 'status']);
}

// ==================== STAFF & USERS ====================
async function fetchAndRenderStaff() {
    fetchAndRender('/staff', 'tbody-staff', ['employeeId', 'name', 'designation', 'phone', 'email']);
}

async function fetchAndRenderUsers() {
    fetchAndRender('/users', 'tbody-users', ['name', 'email', 'role']);
}

// ==================== PURCHASES, RECEIPTS & PAYMENTS ====================
async function fetchAndRenderPurchases() {
    fetchAndRender('/purchases', 'tbody-purchases', ['poNumber', 'vendorName', 'date', 'totalAmount', 'status']);
}

async function fetchAndRenderReceipts() {
    fetchAndRender('/receipts', 'tbody-receipts', ['receiptNumber', 'customer.name', 'date', 'amount', 'paymentMode']);
}

async function fetchAndRenderPayments() {
    fetchAndRender('/payments', 'tbody-payments', ['paymentNumber', 'vendorName', 'date', 'amount', 'paymentMode']);
}

// ==================== COMPANY PROFILE & BRANDING ====================
async function loadCompanyProfile() {
    try {
        const comp = await apiFetch('/company');
        if (comp) {
            ['comp-name', 'comp-trn', 'comp-phone', 'comp-email', 'comp-address'].forEach(id => {
                const key = id.replace('comp-', '');
                const el = document.getElementById(id);
                if (el && comp[key]) el.value = comp[key];
            });

            if (comp.logoUrl) renderCompanyImagePreview('logo', comp.logoUrl);
            if (comp.headerUrl) renderCompanyImagePreview('header', comp.headerUrl);
            if (comp.footerUrl) renderCompanyImagePreview('footer', comp.footerUrl);
        }
    } catch (e) { console.log('No company profile found or error fetching profile:', e); }
}

function handleCompanyImageUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result;
        companyImageData[type] = base64Data;
        renderCompanyImagePreview(type, base64Data);
    };
    reader.readAsDataURL(file);
}

function removeCompanyImage(type) {
    companyImageData[type] = null;
    const input = document.getElementById(`comp-${type}-input`);
    if (input) input.value = '';

    const previewContainer = document.getElementById(`comp-${type}-preview-container`);
    const previewImg = document.getElementById(`comp-${type}-preview`);

    if (previewContainer && previewImg) {
        previewImg.removeAttribute('src');
        previewImg.classList.add('hidden');
        previewContainer.classList.add('hidden');
        previewContainer.classList.remove('flex');
    }
}

function renderCompanyImagePreview(type, src) {
    const previewContainer = document.getElementById(`comp-${type}-preview-container`);
    const previewImg = document.getElementById(`comp-${type}-preview`);

    if (src && previewContainer && previewImg) {
        previewImg.src = src;
        previewImg.classList.remove('hidden');
        previewContainer.classList.remove('hidden');
        previewContainer.classList.add('flex');
    } else {
        removeCompanyImage(type);
    }
}

async function saveCompanyProfile(event) {
    if (event) event.preventDefault();
    const payload = {
        name: getInput('comp-name'),
        trn: getInput('comp-trn'),
        phone: getInput('comp-phone'),
        email: getInput('comp-email'),
        address: getInput('comp-address'),
        logoUrl: companyImageData.logo || null,
        headerUrl: companyImageData.header || null,
        footerUrl: companyImageData.footer || null
    };

    try {
        await apiFetch('/company', 'POST', payload);
        alert('Company profile saved successfully!');
    } catch (e) { alert('Failed to save company profile: ' + e.message); }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderWorkOrders();
    fetchAndRenderBuildings();
    fetchAndRenderFlats();
    fetchAndRenderAssets();
    loadCompanyProfile();

    ['logo', 'header', 'footer'].forEach(type => {
        const img = document.getElementById(`comp-${type}-preview`);
        if (img) {
            img.onerror = () => removeCompanyImage(type);
        }
    });
});
