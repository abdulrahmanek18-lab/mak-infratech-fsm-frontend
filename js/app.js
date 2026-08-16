// ==================== GLOBAL STATE ====================
const API_BASE_URL = 'https://makinfratech-api.onrender.com/api';
const token = localStorage.getItem('fsm_token');
let userRole = (localStorage.getItem('fsm_role') || 'GUEST').toUpperCase();
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
        if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="${columns.length}" class="p-6 text-center text-gray-500">No data found.</td></tr>`; return; }
        tbody.innerHTML = data.map(item => `<tr>${columns.map(col => {
            let val = item; col.split('.').forEach(part => { val = val ? val[part] : null; });
            return `<td class="px-4 py-3 text-sm text-gray-700">${val !== null && val !== undefined ? val : '-'}</td>`;
        }).join('')}</tr>`).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="${columns.length}" class="p-6 text-center text-red-500">Failed to load data.</td></tr>`; }
}

async function fetchDropdown(endpoint) {
    try { const data = await apiFetch(endpoint); return data.map(item => `<option value="${item.id}">${item.name || item.email || item.poNumber || item.sku || item.contractNumber || item.invoiceNumber}</option>`).join(''); }
    catch (e) { return '<option value="">Error loading</option>'; }
}

function numberToWords(num) {
    const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    if ((num = num.toString()).length > 9) return 'Overflow';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return; var str = '';
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
    modalTitle.innerText = title;
    modalFields.innerHTML = fieldsHtml;
    modal.classList.remove('hidden'); // Removes hidden to show modal
    modalSubmitBtn.style.display = isViewOnly ? 'none' : 'block';
}

function closeModal() {
    modal.classList.add('hidden'); // Adds hidden back to close modal
    modalForm.reset();
    modalError.classList.add('hidden');
    const mb = document.querySelector('#modal > div');
    mb.classList.add('max-w-md');
    mb.classList.remove('max-w-5xl', 'max-w-2xl', 'max-w-3xl', 'max-w-sm', 'p-0');
}

async function handleSubmit(endpoint, data, successMsg, refreshPage) {
    modalSubmitBtn.innerText = 'Saving...';
    modalError.classList.add('hidden');
    try {
        await apiFetch(endpoint, 'POST', data);
        closeModal();
        alert(successMsg);
        if (refreshPage) {
            const handlers = { 'tbody-work-orders': fetchAndRenderWorkOrders, 'tbody-invoices': fetchAndRenderInvoices, 'tbody-inventory': fetchAndRenderAssets, 'tbody-staff': fetchAndRenderStaff, 'tbody-purchases': fetchAndRenderPurchases, 'tbody-receipts': fetchAndRenderReceipts, 'tbody-payments': fetchAndRenderPayments, 'tbody-users': fetchAndRenderUsers, 'tbody-flats': fetchAndRenderFlats };
            if (handlers[refreshPage.tableId]) handlers[refreshPage.tableId]();
            else fetchAndRender(refreshPage.endpoint, refreshPage.tableId, refreshPage.columns);
        }
    } catch (error) {
        modalError.innerText = error.message;
        modalError.classList.remove('hidden');
        modalSubmitBtn.innerText = 'Save';
    }
}

function getInput(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('-translate-x-full'); }
function logout() { localStorage.removeItem('fsm_token'); localStorage.removeItem('fsm_role'); window.location.href = 'login.html'; }

// ==================== VOUCHER FUNCTIONS ====================
async function fetchAndRenderReceipts() {
    const tbody = document.getElementById('tbody-receipts'); if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">Loading...</td></tr>`;
    try {
        const data = await apiFetch('/receipts');
        if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">No Receipts found.</td></tr>`; return; }
        tbody.innerHTML = data.map(item => `<tr><td class="px-4 py-3 text-sm text-gray-700 font-medium">${item.voucherNumber || '-'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.date ? new Date(item.date).toLocaleDateString() : '-'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.customer?.name || '-'}</td><td class="px-4 py-3 text-sm text-gray-700">${item.paymentMode || '-'}</td><td class="px-4 py-3 text-sm text-gray-700">AED ${parseFloat(item.amount || 0).toFixed(2)}</td><td class="px-4 py-3 text-sm text-gray-700"><button onclick="viewVoucher('${item.id}', 'receipt')" class="text-blue-600 hover:text-blue-800 text-sm px-1">View</button></td
