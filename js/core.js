// ==================== GLOBAL STATE ====================
const API_BASE_URL = 'https://makinfratech-api.onrender.com/api';
const token = localStorage.getItem('fsm_token');
let userRole = (localStorage.getItem('fsm_role') || 'SUPER_ADMIN').toUpperCase();
let selectedInvoiceTemplate = localStorage.getItem('invoice_template') || 'modern';
let editingInvoiceId = null;
let signaturePad = null;
let companyImageData = {};
let staffPhotoData = null;
let purchaseReceiptData = null;
let allWoBuildings = [], allWoFlats = [];
let allInvBuildings = [], allInvFlats = [];

// ==================== API HELPER ====================
async function apiFetch(endpoint, method = 'GET', body = null) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'API Error' }));
        throw new Error(err.message || 'Failed to fetch');
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
        return data.map(item => `<option value="${item.id}">${item.name || item.email || item.poNumber || item.sku || item.contractNumber || item.invoiceNumber}</option>`).join(''); 
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

async function handleSubmit(endpoint, data, successMsg, refreshPage) {
    if (modalSubmitBtn) modalSubmitBtn.innerText = 'Saving...';
    if (modalError) modalError.classList.add('hidden');
    try {
        await apiFetch(endpoint, 'POST', data);
        closeModal();
        alert(successMsg);
        if (refreshPage) {
            const handlers = { 
                'tbody-work-orders': fetchAndRenderWorkOrders, 
                'tbody-invoices': fetchAndRenderInvoices, 
                'tbody-inventory': fetchAndRenderAssets, 
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

// ==================== RECEIPT & PAYMENT VOUCHERS ====================
async function fetchAndRenderReceipts() {
    const tbody = document.getElementById('tbody-receipts'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/receipts');
        if (!Array.isArray(data) || data.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">No Receipts found.</td></tr>`; return; }
        tbody.innerHTML = data.map(item => `<tr><td class="px-4 py-3 text-sm text-gray-700 font-medium">${item.voucherNumber || '-'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.date ? new Date(item.date).toLocaleDateString() : '-'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.customer?.name || '-'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.paymentMode || '-'}</td><td class="px-4 py-3 text-sm text-gray-700">AED ${parseFloat(item.amount || 0).toFixed(2)}</td><td class="px-4 py-3 text-sm text-gray-700"><button onclick="viewVoucher('${item.id}', 'receipt')" class="text-blue-600 hover:text-blue-800 text-sm px-1">View</button></td></tr>`).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">Failed to load data.</td></tr>`; }
}

async function openReceiptModal() {
    const co = await fetchDropdown('/customers');
    openModal('New Receipt Voucher', `<div><label class="block text-sm font-medium text-gray-700 mb-1">Date *</label><input type="date" id="rv_date" required class="dark-input"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Client *</label><select id="rv_customerId" required onchange="loadUnpaidInvoices()" class="dark-input"><option value="">Select Client</option>${co}</select></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Link to Invoice</label><select id="rv_invoiceId" onchange="autoFillReceiptAmount()" class="dark-input"><option value="">Select Client First</option></select></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Amount (AED) *</label><input type="number" step="0.01" id="rv_amount" required class="dark-input"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label><select id="rv_mode" onchange="toggleChequeFields('rv')" class="dark-input"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option><option value="CARD">Credit Card</option><option value="ONLINE">Online</option></select></div><div id="rv_cheque_fields" style="display:none;"><div class="grid grid-cols-2 gap-4"><div><label class="block text-sm font-medium text-gray-700 mb-1">Cheque No.</label><input type="text" id="rv_chequeNo" class="dark-input"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Bank Name</label><input type="text" id="rv_bankName" class="dark-input"></div></div><div class="grid grid-cols-2 gap-4 mt-2"><div><label class="block text-sm font-medium text-gray-700 mb-1">Cheque Date</label><input type="date" id="rv_chequeDate" class="dark-input"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Status</label><select id="rv_chequeStatus" class="dark-input"><option value="RECEIVED">Received</option><option value="DEPOSITED">Deposited</option><option value="CLEARED">Cleared</option><option value="BOUNCED">Bounced</option></select></div></div></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea id="rv_desc" class="dark-input"></textarea></div>`);
    const dateEl = document.getElementById('rv_date');
    if (dateEl) dateEl.valueAsDate = new Date();
    if (modalForm) {
        modalForm.onsubmit = (e) => { e.preventDefault(); handleSubmit('/receipts', { date: getInput('rv_date'), customerId: getInput('rv_customerId'), invoiceId: getInput('rv_invoiceId') || null, amount: parseFloat(getInput('rv_amount')), paymentMode: getInput('rv_mode'), chequeNumber: getInput('rv_chequeNo'), bankName: getInput('rv_bankName'), chequeDate: getInput('rv_chequeDate'), chequeStatus: getInput('rv_chequeStatus'), description: getInput('rv_desc') }, 'Receipt saved!', { tableId: 'tbody-receipts' }); };
    }
}

async function loadUnpaidInvoices() {
    const ci = getInput('rv_customerId'); const is = document.getElementById('rv_invoiceId');
    if (!is) return;
    is.innerHTML = '<option value="">Loading...</option>';
    if (ci) { 
        try {
            const invs = await apiFetch('/invoices'); 
            const up = Array.isArray(invs) ? invs.filter(inv => inv.customerId === ci && inv.status !== 'PAID' && inv.status !== 'VOID') : []; 
            is.innerHTML = '<option value="">None / Unlinked</option>' + up.map(inv => `<option value="${inv.id}" data-balance="${inv.balanceDue}">${inv.invoiceNumber} (Bal: AED ${inv.balanceDue})</option>`).join(''); 
        } catch(e) {
            is.innerHTML = '<option value="">Error loading invoices</option>';
        }
    } else { 
        is.innerHTML = '<option value="">Select Client First</option>'; 
    }
}

function autoFillReceiptAmount() { 
    const is = document.getElementById('rv_invoiceId'); 
    if (!is || is.selectedIndex < 0) return;
    const opt = is.options[is.selectedIndex];
    const b = opt ? opt.getAttribute('data-balance') : null; 
    if (b) { const amt = document.getElementById('rv_amount'); if (amt) amt.value = b; }
}

async function fetchAndRenderPayments() {
    const tbody = document.getElementById('tbody-payments'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/payments');
        if (!Array.isArray(data) || data.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">No Payments found.</td></tr>`; return; }
        tbody.innerHTML = data.map(item => `<tr><td class="px-4 py-3 text-sm text-gray-700 font-medium">${item.voucherNumber || '-'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.date ? new Date(item.date).toLocaleDateString() : '-'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.payeeName || '-'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.paymentMode || '-'}</td><td class="px-4 py-3 text-sm text-gray-700">AED ${parseFloat(item.amount || 0).toFixed(2)}</td><td class="px-4 py-3 text-sm text-gray-700"><button onclick="viewVoucher('${item.id}', 'payment')" class="text-blue-600 hover:text-blue-800 text-sm px-1">View</button></td></tr>`).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">Failed to load data.</td></tr>`; }
}

async function openPaymentModal() {
    openModal('New Payment Voucher', `<div><label class="block text-sm font-medium text-gray-700 mb-1">Date *</label><input type="date" id="pv_date" required class="dark-input"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Payee *</label><input type="text" id="pv_payee" required class="dark-input"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Amount (AED) *</label><input type="number" step="0.01" id="pv_amount" required class="dark-input"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label><select id="pv_mode" onchange="toggleChequeFields('pv')" class="dark-input"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option><option value="CARD">Credit Card</option><option value="ONLINE">Online</option></select></div><div id="pv_cheque_fields" style="display:none;"><div class="grid grid-cols-2 gap-4"><div><label class="block text-sm font-medium text-gray-700 mb-1">Cheque No.</label><input type="text" id="pv_chequeNo" class="dark-input"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Bank Name</label><input type="text" id="pv_bankName" class="dark-input"></div></div><div class="grid grid-cols-2 gap-4 mt-2"><div><label class="block text-sm font-medium text-gray-700 mb-1">Cheque Date</label><input type="date" id="pv_chequeDate" class="dark-input"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Status</label><select id="pv_chequeStatus" class="dark-input"><option value="ISSUED">Issued</option><option value="CLEARED">Cleared</option><option value="BOUNCED">Bounced</option></select></div></div></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea id="pv_desc" class="dark-input"></textarea></div>`);
    const dateEl = document.getElementById('pv_date');
    if (dateEl) dateEl.valueAsDate = new Date();
    if (modalForm) {
        modalForm.onsubmit = (e) => { e.preventDefault(); handleSubmit('/payments', { date: getInput('pv_date'), payeeName: getInput('pv_payee'), amount: parseFloat(getInput('pv_amount')), paymentMode: getInput('pv_mode'), chequeNumber: getInput('pv_chequeNo'), bankName: getInput('pv_bankName'), chequeDate: getInput('pv_chequeDate'), chequeStatus: getInput('pv_chequeStatus'), description: getInput('pv_desc') }, 'Payment saved!', { tableId: 'tbody-payments' }); };
    }
}

function toggleChequeFields(p) { 
    const modeEl = document.getElementById(`${p}_mode`);
    const cd = document.getElementById(`${p}_cheque_fields`); 
    if (modeEl && cd) cd.style.display = modeEl.value === 'CHEQUE' ? 'block' : 'none'; 
}

async function viewVoucher(id, type) {
    try {
        const v = await apiFetch(type === 'receipt' ? `/receipts/${id}` : `/payments/${id}`);
        const comp = await apiFetch('/company').catch(() => ({}));
        const ir = type === 'receipt'; const aw = numberToWords(parseFloat(v.amount || 0));
        const mb = document.querySelector('#modal > div'); 
        if (mb) { mb.classList.remove('max-w-md'); mb.classList.add('max-w-3xl', 'p-0'); }
        
        // Handling broken/missing image URLs gracefully to prevent image loading errors
        const logoHtml = comp.logoUrl ? `<img src="${comp.logoUrl}" class="h-12 mb-2" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='block';"><h1 class="text-xl font-bold text-blue-800" style="display:none;">${comp.name || 'MAK INFRATECH'}</h1>` : `<h1 class="text-xl font-bold text-blue-800">${comp.name || 'MAK INFRATECH'}</h1>`;
        const sealHtml = comp.companySealUrl ? `<img src="${comp.companySealUrl}" class="w-24 h-24 object-contain mx-auto opacity-90" onerror="this.onerror=null; this.style.display='none';">` : '';

        openModal('Voucher Document', `<div class="no-print sticky top-0 bg-slate-50 py-2 px-4 flex justify-end gap-2 z-10 border-b"><button onclick="window.print()" class="bg-gray-800 text-white px-4 py-2 rounded text-sm">Print</button><button onclick="downloadVoucherPDF('${v.voucherNumber}')" class="bg-blue-600 text-white px-4 py-2 rounded text-sm">PDF</button><button onclick="closeModal()" class="bg-red-500 text-white px-4 py-2 rounded text-sm">Close</button></div><div id="print-area" class="a4-page" style="min-height:500px;padding:40px;"><div class="a4-header"><div>${logoHtml}<p class="text-xs text-gray-600">${comp.address||''}</p><p class="text-xs text-gray-600">TRN: ${comp.trn||'N/A'}</p></div><div class="text-right"><h2 class="text-xl font-bold uppercase">${ir?'RECEIPT VOUCHER':'PAYMENT VOUCHER'}</h2></div></div><div class="grid grid-cols-2 gap-4 mb-6 text-sm"><div><strong>Voucher No:</strong> ${v.voucherNumber}</div><div><strong>Date:</strong> ${v.date?new Date(v.date).toLocaleDateString():'N/A'}</div><div><strong>Mode:</strong> ${v.paymentMode}</div>${v.chequeNumber?`<div><strong>Cheque:</strong> ${v.chequeNumber} (${v.bankName})</div>`:''}</div><div class="border p-4 rounded mb-6"><div class="text-sm mb-2"><strong>${ir?'From':'To'}:</strong> ${ir?v.customer?.name:v.payeeName||'N/A'}</div><div class="text-sm mb-2"><strong>Amount:</strong> AED ${parseFloat(v.amount || 0).toFixed(2)}</div><div class="text-sm mb-2"><strong>In Words:</strong> <span class="italic">${aw}</span></div><div class="text-sm"><strong>Desc:</strong> ${v.description||'N/A'}</div></div><div class="flex justify-between mt-12 text-sm items-end"><div class="text-center">${sealHtml}<span class="text-xs text-gray-500 mt-1 block">Seal</span></div><div class="text-center"><div class="text-xs text-gray-500 mb-1">Prepared By</div><div class="h-8"></div><div class="border-t border-gray-800 w-40 pt-1">Signatory</div></div><div class="text-center"><div class="text-xs text-gray-500 mb-1">Received By</div><div class="h-8"></div><div class="border-t border-gray-800 w-40 pt-1">Signature</div></div></div></div>`, true);
    } catch (e) { alert('Failed to load voucher'); }
}

function downloadVoucherPDF(vn) { 
    const el = document.getElementById('print-area'); 
    if (typeof html2pdf !== 'undefined' && el) { 
        html2pdf().set({margin:0,filename:`${vn}.pdf`,image:{type:'jpeg',quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(el).save(); 
    } else { 
        alert('PDF generator library not loaded.'); 
    } 
}

// ==================== WORK ORDERS ====================
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
            return `<tr><td class="px-4 py-3 text-sm text-gray-700 font-medium">${item.woNumber}</td><td class="px-4 py-3 text-sm text-gray-700">${item.customer?.name||'-'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.building?.name||'-'} ${item.flat?.unitNumber?'('+item.flat.unitNumber+')':''}</td><td class="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">${item.description||item.title}</td><td class="px-4 py-3 text-sm text-gray-700">${item.scheduledDate?new Date(item.scheduledDate).toLocaleString():'N/A'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.technician?.name||'Unassigned'}</td><td class="px-4 py-3"><select onchange="updateWoStatus('${item.id}',this.value)" class="px-2 py-1 bg-white border border-gray-300 rounded-md text-xs ${sc[s]||''}"><option value="PENDING" ${s==='PENDING'?'selected':''}>Pending</option><option value="ASSIGNED" ${s==='ASSIGNED'?'selected':''}>Scheduled</option><option value="IN_PROGRESS" ${s==='IN_PROGRESS'?'selected':''}>In Progress</option><option value="PENDING_PARTS" ${s==='PENDING_PARTS'?'selected':''}>Pending Parts</option><option value="COMPLETED" ${s==='COMPLETED'?'selected':''}>Completed</option><option value="CANCELLED" ${s==='CANCELLED'?'selected':''}>Cancelled</option></select></td><td class="px-4 py-3 text-sm flex gap-1"><button onclick="viewWorkOrderDetails('${item.id}')" class="text-blue-600 px-1">View</button>${cm?`<button onclick="openServiceReportModal('${item.id}')" class="text-purple-600 px-1">Report</button><button onclick="deleteWo('${item.id}')" class="text-red-600 px-1">Del</button>`:''}</td></tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500">Failed to load data.</td></tr>`; }
}

async function updateWoStatus(id, status) { try { await apiFetch(`/work-orders/${id}/status`, 'PATCH', { status }); fetchAndRenderWorkOrders(); } catch (e) { alert('Failed: ' + e.message); } }
async function deleteWo(id) { if (confirm('Delete this WO?')) { try { await apiFetch(`/work-orders/${id}`, 'DELETE'); fetchAndRenderWorkOrders(); } catch (e) { alert('Failed: ' + e.message); } } }

async function viewWorkOrderDetails(id) {
    try {
        const wo = await apiFetch(`/work-orders/${id}`);
        const isTech = userRole === 'TECHNICIAN';
        openModal('WO Details', `<div class="space-y-4"><div class="flex justify-between border-b pb-3"><span class="font-bold text-lg text-blue-600">WO: ${wo.woNumber}</span><span class="text-sm text-gray-500">${new Date(wo.createdAt).toLocaleDateString()}</span></div><div class="grid grid-cols-2 gap-4 text-sm"><div><strong>Client:</strong> ${wo.customer?.name||'N/A'}</div><div><strong>Building:</strong> ${wo.building?.name||'N/A'}</div><div><strong>Tech:</strong> ${wo.technician?.name||'Unassigned'}</div><div><strong>Schedule:</strong> ${wo.scheduledDate?new Date(wo.scheduledDate).toLocaleString():'N/A'}</div></div><div class="text-sm"><strong>Complaint:</strong><br>${wo.description||wo.title}</div>${isTech?`<div class="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm">Phone numbers hidden.</div>`:`<div class="text-sm"><strong>Phone:</strong> ${wo.customer?.phone||'N/A'}</div>`}<div class="flex gap-3 pt-4"><button type="button" onclick="closeModal()" class="flex-1 bg-gray-100 py-3 rounded-lg font-semibold">Close</button><button type="button" onclick="openServiceReportModal('${wo.id}')" class="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold">Service Report</button></div></div>`, true);
    } catch (e) { alert('Failed to load WO'); }
}

async function openServiceReportModal(workOrderId) {
    try {
        const wo = await apiFetch(`/work-orders/${workOrderId}`);
        openModal('Service Report', `<div class="space-y-4"><div class="flex justify-between border-b pb-3"><span class="font-bold text-lg text-blue-600">Service Report</span><span class="text-sm text-gray-500">WO: ${wo.woNumber}</span></div><div class="text-sm"><strong>Complaint:</strong><br>${wo.description||wo.title}</div><div class="grid grid-cols-2 gap-4"><div><label class="block text-sm mb-1">Started</label><input type="datetime-local" id="sr_startedAt" class="dark-input"></div><div><label class="block text-sm mb-1">Ended</label><input type="datetime-local" id="sr_completedAt" class="dark-input"></div></div><div><label class="block text-sm mb-1">Work Performed</label><textarea id="sr_workPerformed" rows="3" class="dark-input"></textarea></div><div><label class="block text-sm mb-1">Materials</label><textarea id="sr_materials" rows="2" class="dark-input"></textarea></div><div><label class="block text-sm mb-1">Observations</label><textarea id="sr_observations" rows="2" class="dark-input"></textarea></div><div><label class="block text-sm mb-1">Signature</label><div class="border-2 border-gray-300 rounded-lg p-2 bg-white"><canvas id="signature-canvas" width="400" height="150" class="w-full"></canvas></div><button type="button" onclick="clearSignature()" class="text-xs text-red-500 mt-1">Clear</button></div><div class="flex gap-3 pt-4"><button type="button" onclick="closeModal()" class="flex-1 bg-gray-100 py-3 rounded-lg font-semibold">Cancel</button><button type="button" onclick="saveAndDownloadPDF('${wo.id}')" class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold">Save & PDF</button></div></div>`, true);
        const canvas = document.getElementById('signature-canvas');
        if (canvas && typeof SignaturePad !== 'undefined') {
            signaturePad = new SignaturePad(canvas);
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio; canvas.height = canvas.offsetHeight * ratio; canvas.getContext("2d").scale(ratio, ratio);
        }
    } catch (e) { alert('Failed to load WO'); }
}

function clearSignature() { if (signaturePad) signaturePad.clear(); }

async function saveAndDownloadPDF(workOrderId) {
    const sa = getInput('sr_startedAt'), ca = getInput('sr_completedAt'), wp = getInput('sr_workPerformed'), m = getInput('sr_materials'), o = getInput('sr_observations'), sd = (signaturePad && !signaturePad.isEmpty()) ? signaturePad.toDataURL() : null;
    if (!wp || !sa || !ca) { alert('Fill all fields.'); return; }
    try {
        await apiFetch(`/work-orders/${workOrderId}`, 'PATCH', { startedAt: sa, completedAt: ca, workPerformed: wp, materialsUsed: { items: m }, observations: o, clientSignature: sd, technicianName: 'Admin' });
        await apiFetch(`/work-orders/${workOrderId}/status`, 'PATCH', { status: 'COMPLETED' });
        const pc = document.createElement('div'); pc.style.padding = '20px'; pc.style.fontFamily = 'Arial'; pc.style.color = '#333';
        pc.innerHTML = `<h2 style="text-align:center;color:#1e3a8a;border-bottom:2px solid #333;padding-bottom:10px;">Service Report</h2><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><hr><div style="display:flex;justify-content:space-between"><p><strong>Start:</strong> ${new Date(sa).toLocaleString()}</p><p><strong>End:</strong> ${new Date(ca).toLocaleString()}</p></div><h4>Work:</h4><p>${wp}</p><h4>Materials:</h4><p>${m}</p><h4>Observations:</h4><p>${o}</p><hr><div style="display:flex;justify-content:space-between;align-items:flex-end"><p><strong>Tech:</strong> Admin</p><div style="text-align:center">${sd?`<img src="${sd}" height="80" width="200"><br>`:''}<span style="border-top:1px solid #000;padding-top:5px;display:inline-block;width:200px">Signature</span></div></div>`;
        document.body.appendChild(pc);
        if (typeof html2pdf !== 'undefined') {
            html2pdf().set({margin:10,filename:`SR_${workOrderId.substring(0,8)}.pdf`,image:{type:'jpeg',quality:0.98},html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(pc).save().then(() => document.body.removeChild(pc));
        }
        closeModal(); fetchAndRenderWorkOrders();
    } catch (e) { alert('Failed: ' + e.message); }
}

async function openWorkOrderModal(prefillDate) {
    const customers = await apiFetch('/customers').catch(() => []); 
    allWoBuildings = await apiFetch('/buildings').catch(() => []); 
    allWoFlats = await apiFetch('/flats').catch(() => []); 
    const techs = await apiFetch('/users').catch(() => []);
    
    const co = Array.isArray(customers) ? customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('') : '';
    const to = Array.isArray(techs) ? techs.map(t => `<option value="${t.id}">${t.name}</option>`).join('') : '';
    
    openModal('New Work Order', `<div><label class="block text-sm mb-1">Client *</label><select id="wo_customerId" required onchange="filterWoBuildings()" class="dark-input"><option value="">Select</option>${co}</select></div><div><label class="block text-sm mb-1">Building *</label><select id="wo_buildingId" required onchange="filterWoFlats()" disabled class="dark-input"><option value="">Select Client First</option></select></div><div><label class="block text-sm mb-1">Flat</label><select id="wo_flatId" disabled class="dark-input"><option value="">Select Building</option></select></div><div><label class="block text-sm mb-1">Technician</label><select id="wo_technicianId" class="dark-input"><option value="">Unassigned</option>${to}</select></div><div class="grid grid-cols-2 gap-4"><div><label class="block text-sm mb-1">Date *</label><input type="date" id="wo_scheduledDate" required class="dark-input"></div><div><label class="block text-sm mb-1">Time *</label><input type="time" id="wo_scheduledTime" required class="dark-input"></div></div><div><label class="block text-sm mb-1">Complaint *</label><textarea id="wo_complaint" required rows="3" class="dark-input"></textarea></div>`);
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

// ==================== FLATS ====================
async function fetchAndRenderFlats() {
    const tbody = document.getElementById('tbody-flats'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/flats');
        if (!Array.isArray(data) || data.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">No Flats found.</td></tr>`; return; }
        tbody.innerHTML = data.map(item => `<tr><td class="px-4 py-3 text-sm font-medium">${item.unitNumber||'-'}</td><td class="px-4 py-3 text-sm">${item.building?.name||'-'}</td><td class="px-4 py-3 text-sm">${item.floor||'-'}</td><td class="px-4 py-3 text-sm">${item.type||'-'}</td></tr>`).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-red-500">Failed.</td></tr>`; }
}

async function openFlatModal() {
    const bo = await fetchDropdown('/buildings');
    openModal('New Flat', `<div><label class="block text-sm mb-1">Building *</label><select id="fl_buildingId" required class="dark-input"><option value="">Select</option>${bo}</select></div><div><label class="block text-sm mb-1">Unit Number *</label><input type="text" id="fl_unitNumber" required class="dark-input"></div><div class="grid grid-cols-2 gap-4"><div><label class="block text-sm mb-1">Floor</label><input type="number" id="fl_floor" class="dark-input"></div><div><label class="block text-sm mb-1">Type</label><input type="text" id="fl_type" class="dark-input"></div></div>`);
    if (modalForm) {
        modalForm.onsubmit = (e) => { 
            e.preventDefault(); 
            const floorVal = getInput('fl_floor');
            handleSubmit('/flats', { 
                buildingId: getInput('fl_buildingId'), 
                unitNumber: getInput('fl_unitNumber'), 
                floor: floorVal !== '' ? parseInt(floorVal, 10) : null, 
                type: getInput('fl_type') 
            }, 'Flat created!', { tableId: 'tbody-flats' }); 
        };
    }
}

// ==================== ASSETS / INVENTORY ====================
async function fetchAndRenderAssets() {
    const tbody = document.getElementById('tbody-inventory'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/inventory');
        if (!Array.isArray(data) || data.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-500">No Inventory Assets found.</td></tr>`; 
            return; 
        }
        tbody.innerHTML = data.map(item => `<tr>
            <td class="px-4 py-3 text-sm font-medium text-gray-700">${item.sku || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.name || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.category || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.quantity !== undefined ? item.quantity : '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.unit || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">AED ${item.unitPrice ? parseFloat(item.unitPrice).toFixed(2) : '0.00'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.location || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700"><button onclick="viewAssetDetails('${item.id}')" class="text-blue-600 hover:text-blue-800">View</button></td>
        </tr>`).join('');
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500">Failed to load inventory assets.</td></tr>`; 
    }
}

async function openAssetModal() {
    openModal('New Asset', `
        <div><label class="block text-sm mb-1">SKU / Item Code *</label><input type="text" id="ast_sku" required class="dark-input"></div>
        <div><label class="block text-sm mb-1">Name *</label><input type="text" id="ast_name" required class="dark-input"></div>
        <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm mb-1">Category</label><input type="text" id="ast_category" class="dark-input"></div>
            <div><label class="block text-sm mb-1">Unit</label><input type="text" id="ast_unit" placeholder="e.g. Pcs, Box, Kg" class="dark-input"></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm mb-1">Quantity</label><input type="number" id="ast_qty" value="0" class="dark-input"></div>
            <div><label class="block text-sm mb-1">Unit Price (AED)</label><input type="number" step="0.01" id="ast_price" value="0.00" class="dark-input"></div>
        </div>
        <div><label class="block text-sm mb-1">Location / Store</label><input type="text" id="ast_location" class="dark-input"></div>
    `);
    if (modalForm) {
        modalForm.onsubmit = (e) => {
            e.preventDefault();
            handleSubmit('/inventory', {
                sku: getInput('ast_sku'),
                name: getInput('ast_name'),
                category: getInput('ast_category'),
                unit: getInput('ast_unit'),
                quantity: parseInt(getInput('ast_qty')) || 0,
                unitPrice: parseFloat(getInput('ast_price')) || 0,
                location: getInput('ast_location')
            }, 'Asset saved!', { tableId: 'tbody-inventory' });
        };
    }
}

async function viewAssetDetails(id) {
    try {
        const item = await apiFetch(`/inventory/${id}`);
        openModal('Asset Details', `
            <div class="space-y-3 text-sm">
                <div><strong>SKU:</strong> ${item.sku || 'N/A'}</div>
                <div><strong>Name:</strong> ${item.name || 'N/A'}</div>
                <div><strong>Category:</strong> ${item.category || 'N/A'}</div>
                <div><strong>Quantity:</strong> ${item.quantity || 0} ${item.unit || ''}</div>
                <div><strong>Unit Price:</strong> AED ${parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                <div><strong>Location:</strong> ${item.location || 'N/A'}</div>
                <div class="pt-4"><button type="button" onclick="closeModal()" class="w-full bg-gray-200 py-2 rounded">Close</button></div>
            </div>
        `, true);
    } catch (e) { alert('Failed to fetch asset details.'); }
}

// ==================== INVOICES ====================
async function fetchAndRenderInvoices() {
    const tbody = document.getElementById('tbody-invoices'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/invoices');
        if (!Array.isArray(data) || data.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500">No Invoices found.</td></tr>`; 
            return; 
        }
        tbody.innerHTML = data.map(item => `<tr>
            <td class="px-4 py-3 text-sm font-medium text-gray-700">${item.invoiceNumber || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.customer?.name || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">AED ${parseFloat(item.totalAmount || 0).toFixed(2)}</td>
            <td class="px-4 py-3 text-sm text-gray-700">AED ${parseFloat(item.balanceDue || 0).toFixed(2)}</td>
            <td class="px-4 py-3 text-sm text-gray-700"><span class="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">${item.status || 'DRAFT'}</span></td>
            <td class="px-4 py-3 text-sm text-gray-700 flex gap-2">
                <button onclick="viewInvoiceDetails('${item.id}')" class="text-blue-600 hover:text-blue-800">View</button>
                <button onclick="deleteInvoice('${item.id}')" class="text-red-600 hover:text-red-800">Del</button>
            </td>
        </tr>`).join('');
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500">Failed to load invoices.</td></tr>`; 
    }
}

async function openInvoiceModal() {
    const co = await fetchDropdown('/customers');
    openModal('New Invoice', `
        <div><label class="block text-sm mb-1">Customer *</label><select id="inv_customerId" required class="dark-input"><option value="">Select Customer</option>${co}</select></div>
        <div><label class="block text-sm mb-1">Date *</label><input type="date" id="inv_date" required class="dark-input"></div>
        <div><label class="block text-sm mb-1">Due Date</label><input type="date" id="inv_dueDate" class="dark-input"></div>
        <div><label class="block text-sm mb-1">Total Amount (AED) *</label><input type="number" step="0.01" id="inv_totalAmount" required class="dark-input"></div>
        <div><label class="block text-sm mb-1">Notes</label><textarea id="inv_notes" class="dark-input"></textarea></div>
    `);
    const dateEl = document.getElementById('inv_date');
    if (dateEl) dateEl.valueAsDate = new Date();
    if (modalForm) {
        modalForm.onsubmit = (e) => {
            e.preventDefault();
            const tot = parseFloat(getInput('inv_totalAmount')) || 0;
            handleSubmit('/invoices', {
                customerId: getInput('inv_customerId'),
                date: getInput('inv_date'),
                dueDate: getInput('inv_dueDate') || null,
                totalAmount: tot,
                balanceDue: tot,
                notes: getInput('inv_notes'),
                status: 'UNPAID'
            }, 'Invoice Created!', { tableId: 'tbody-invoices' });
        };
    }
}

async function viewInvoiceDetails(id) {
    try {
        const inv = await apiFetch(`/invoices/${id}`);
        openModal('Invoice Details', `
            <div class="space-y-3 text-sm">
                <div><strong>Invoice #:</strong> ${inv.invoiceNumber}</div>
                <div><strong>Customer:</strong> ${inv.customer?.name || 'N/A'}</div>
                <div><strong>Date:</strong> ${inv.date ? new Date(inv.date).toLocaleDateString() : 'N/A'}</div>
                <div><strong>Total:</strong> AED ${parseFloat(inv.totalAmount || 0).toFixed(2)}</div>
                <div><strong>Balance Due:</strong> AED ${parseFloat(inv.balanceDue || 0).toFixed(2)}</div>
                <div><strong>Status:</strong> ${inv.status}</div>
                <div class="pt-4"><button type="button" onclick="closeModal()" class="w-full bg-gray-200 py-2 rounded">Close</button></div>
            </div>
        `, true);
    } catch (e) { alert('Failed to fetch invoice details.'); }
}

async function deleteInvoice(id) {
    if (confirm('Are you sure you want to delete this invoice?')) {
        try {
            await apiFetch(`/invoices/${id}`, 'DELETE');
            fetchAndRenderInvoices();
        } catch (e) { alert('Failed to delete invoice: ' + e.message); }
    }
}

// ==================== PURCHASES ====================
async function fetchAndRenderPurchases() {
    const tbody = document.getElementById('tbody-purchases'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/purchases');
        if (!Array.isArray(data) || data.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">No Purchase Orders found.</td></tr>`; 
            return; 
        }
        tbody.innerHTML = data.map(item => `<tr>
            <td class="px-4 py-3 text-sm font-medium text-gray-700">${item.poNumber || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.supplierName || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">AED ${parseFloat(item.amount || 0).toFixed(2)}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.status || 'PENDING'}</td>
            <td class="px-4 py-3 text-sm text-gray-700"><button onclick="viewPurchaseDetails('${item.id}')" class="text-blue-600 hover:text-blue-800">View</button></td>
        </tr>`).join('');
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">Failed to load purchases.</td></tr>`; 
    }
}

async function openPurchaseModal() {
    openModal('New Purchase Order', `
        <div><label class="block text-sm mb-1">Supplier Name *</label><input type="text" id="po_supplier" required class="dark-input"></div>
        <div><label class="block text-sm mb-1">Date *</label><input type="date" id="po_date" required class="dark-input"></div>
        <div><label class="block text-sm mb-1">Total Amount (AED) *</label><input type="number" step="0.01" id="po_amount" required class="dark-input"></div>
        <div><label class="block text-sm mb-1">Description</label><textarea id="po_desc" class="dark-input"></textarea></div>
    `);
    const dateEl = document.getElementById('po_date');
    if (dateEl) dateEl.valueAsDate = new Date();
    if (modalForm) {
        modalForm.onsubmit = (e) => {
            e.preventDefault();
            handleSubmit('/purchases', {
                supplierName: getInput('po_supplier'),
                date: getInput('po_date'),
                amount: parseFloat(getInput('po_amount')) || 0,
                description: getInput('po_desc')
            }, 'Purchase Saved!', { tableId: 'tbody-purchases' });
        };
    }
}

async function viewPurchaseDetails(id) {
    try {
        const item = await apiFetch(`/purchases/${id}`);
        openModal('PO Details', `
            <div class="space-y-3 text-sm">
                <div><strong>PO #:</strong> ${item.poNumber || 'N/A'}</div>
                <div><strong>Supplier:</strong> ${item.supplierName || 'N/A'}</div>
                <div><strong>Date:</strong> ${item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}</div>
                <div><strong>Amount:</strong> AED ${parseFloat(item.amount || 0).toFixed(2)}</div>
                <div><strong>Description:</strong> ${item.description || 'N/A'}</div>
                <div class="pt-4"><button type="button" onclick="closeModal()" class="w-full bg-gray-200 py-2 rounded">Close</button></div>
            </div>
        `, true);
    } catch (e) { alert('Failed to load purchase details.'); }
}

// ==================== STAFF & USERS ====================
async function fetchAndRenderStaff() {
    const tbody = document.getElementById('tbody-staff'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/staff');
        if (!Array.isArray(data) || data.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500">No Staff members found.</td></tr>`; 
            return; 
        }
        tbody.innerHTML = data.map(item => `<tr>
            <td class="px-4 py-3 text-sm font-medium text-gray-700">${item.name || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.role || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.phone || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.email || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.status || 'ACTIVE'}</td>
        </tr>`).join('');
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500">Failed to load staff list.</td></tr>`; 
    }
}

async function openStaffModal() {
    openModal('New Staff Member', `
        <div><label class="block text-sm mb-1">Full Name *</label><input type="text" id="st_name" required class="dark-input"></div>
        <div><label class="block text-sm mb-1">Role *</label><input type="text" id="st_role" placeholder="e.g. Technician, AC Specialist" required class="dark-input"></div>
        <div><label class="block text-sm mb-1">Phone</label><input type="text" id="st_phone" class="dark-input"></div>
        <div><label class="block text-sm mb-1">Email</label><input type="email" id="st_email" class="dark-input"></div>
    `);
    if (modalForm) {
        modalForm.onsubmit = (e) => {
            e.preventDefault();
            handleSubmit('/staff', {
                name: getInput('st_name'),
                role: getInput('st_role'),
                phone: getInput('st_phone'),
                email: getInput('st_email')
            }, 'Staff Saved!', { tableId: 'tbody-staff' });
        };
    }
}

async function fetchAndRenderUsers() {
    const tbody = document.getElementById('tbody-users'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/users');
        if (!Array.isArray(data) || data.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500">No Users found.</td></tr>`; 
            return; 
        }
        tbody.innerHTML = data.map(item => `<tr>
            <td class="px-4 py-3 text-sm font-medium text-gray-700">${item.name || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.email || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.role || 'USER'}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.active ? 'Active' : 'Inactive'}</td>
        </tr>`).join('');
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-red-500">Failed to load users.</td></tr>`; 
    }
}

async function openUserModal() {
    openModal('New System User', `
        <div><label class="block text-sm mb-1">Name *</label><input type="text" id="usr_name" required class="dark-input"></div>
        <div><label class="block text-sm mb-1">Email *</label><input type="email" id="usr_email" required class="dark-input"></div>
        <div><label class="block text-sm mb-1">Role *</label>
            <select id="usr_role" required class="dark-input">
                <option value="TECHNICIAN">Technician</option>
                <option value="COORDINATOR">Coordinator</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
            </select>
        </div>
    `);
    if (modalForm) {
        modalForm.onsubmit = (e) => {
            e.preventDefault();
            handleSubmit('/users', {
                name: getInput('usr_name'),
                email: getInput('usr_email'),
                role: getInput('usr_role')
            }, 'User created!', { tableId: 'tbody-users' });
        };
    }
}

// ==================== AUTO-INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderWorkOrders();
    fetchAndRenderReceipts();
    fetchAndRenderPayments();
    fetchAndRenderFlats();
    fetchAndRenderAssets();
    fetchAndRenderInvoices();
    fetchAndRenderPurchases();
    fetchAndRenderStaff();
    fetchAndRenderUsers();
});
