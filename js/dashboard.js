// ==================== DASHBOARD DATA LOADING ====================
let dashboardData = { wos: [], invs: [], amcs: [] };

async function loadDashboardData() {
    try {
        const wos = await apiFetch('/work-orders');
        dashboardData.wos = wos;
        renderDashboardWOs(wos);
        generateMiniCalendar();

        const invs = await apiFetch('/invoices');
        dashboardData.invs = invs;
        renderUpcomingInvoices(invs);

        const amcs = await apiFetch('/amc');
        dashboardData.amcs = amcs;
        renderAmcAlerts(amcs);
    } catch (e) { console.error("Failed to load dashboard data", e); }
}

function renderDashboardWOs(wos) {
    const woTbody = document.getElementById('tbody-dash-wo');
    if (!woTbody) return;
    if (wos.length === 0) {
        woTbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-gray-400">
            <div class="flex flex-col items-center">
                <svg class="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                <span>No active work orders for today</span>
            </div>
        </td></tr>`;
    } else {
        const sc = { 'PENDING':'bg-yellow-100 text-yellow-700','ASSIGNED':'bg-blue-100 text-blue-700','IN_PROGRESS':'bg-amber-100 text-amber-700','PENDING_PARTS':'bg-orange-100 text-orange-700','COMPLETED':'bg-green-100 text-green-700' };
        woTbody.innerHTML = wos.slice(0, 5).map(item => {
            const s = item.status || 'PENDING';
            return `<tr>
                <td class="px-4 py-3 text-sm text-blue-600 font-medium">${item.woNumber}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${item.title}<br><span class="text-xs text-gray-400">${item.building?.name||'-'} ${item.flat?.unitNumber?'('+item.flat.unitNumber+')':''}</span></td>
                <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full ${sc[s]}">${s}</span></td>
                <td class="px-4 py-3 text-sm text-gray-700">${item.technician?.name||'Unassigned'}</td>
            </tr>`;
        }).join('');
    }
}

function renderUpcomingInvoices(invs) {
    const list = document.getElementById('upcoming-invoices-list');
    if (!list) return;
    const upcoming = invs.filter(inv => inv.status !== 'PAID' && inv.status !== 'VOID').sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 4);
    if (upcoming.length === 0) {
        list.innerHTML = `<div class="p-6 text-center text-gray-400">No upcoming invoices.</div>`;
    } else {
        list.innerHTML = upcoming.map(inv => {
            const dd = new Date(inv.dueDate); const t = new Date(); const diff = Math.ceil((dd - t) / (1000*60*60*24));
            let bc = 'bg-gray-100 text-gray-600', bt = `Due in ${diff} days`;
            if (diff < 0) { bc = 'bg-red-100 text-red-700'; bt = 'Overdue'; }
            if (diff === 0) { bc = 'bg-orange-100 text-orange-700'; bt = 'Due Today'; }
            if (diff === 1) { bc = 'bg-yellow-100 text-yellow-700'; bt = 'Due Tomorrow'; }
            return `<div class="p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-gray-50 transition">
                <div class="mb-2 md:mb-0">
                    <div class="font-semibold text-gray-800">${inv.customer?.name || 'N/A'}</div>
                    <div class="text-sm text-gray-500">${inv.invoiceNumber}</div>
                </div>
                <div class="flex items-center gap-4">
                    <span class="px-2.5 py-1 text-xs rounded-full ${bc} font-medium">${bt}</span>
                    <div class="text-right">
                        <div class="font-bold text-gray-800">AED ${parseFloat(inv.total).toFixed(2)}</div>
                        <span class="text-xs ${inv.status === 'PARTIAL' ? 'text-yellow-500' : 'text-red-500'}">${inv.status}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
}

function renderAmcAlerts(amcs) {
    const list = document.getElementById('amc-alerts-list');
    if (!list) return;
    const t = new Date();
    const ua = amcs.filter(a => { if (!a.endDate) return false; const e = new Date(a.endDate); const d = Math.ceil((e - t) / (1000*60*60*24)); return d >= 0 && d <= 30; }).sort((a,b) => new Date(a.endDate) - new Date(b.endDate)).slice(0, 4);
    if (ua.length === 0) {
        list.innerHTML = `<div class="text-gray-400 text-center py-4">No alerts.</div>`;
    } else {
        list.innerHTML = ua.map(a => {
            const e = new Date(a.endDate); const d = Math.ceil((e - t) / (1000*60*60*24));
            let bc = 'border-green-200 bg-green-50';
            if (d <= 7) bc = 'border-red-200 bg-red-50';
            else if (d <= 14) bc = 'border-yellow-200 bg-yellow-50';
            return `<div class="p-4 rounded-lg border ${bc}">
                <div class="font-semibold text-gray-800 text-sm">${a.contractNumber}</div>
                <div class="text-xs text-gray-500 mt-1">${a.customer?.name || 'N/A'}</div>
                <div class="text-xs font-bold mt-2 ${d <= 7 ? 'text-red-600' : 'text-gray-600'}">${d === 0 ? 'Expires Today' : `${d} Days Left`}</div>
            </div>`;
        }).join('');
    }
}
