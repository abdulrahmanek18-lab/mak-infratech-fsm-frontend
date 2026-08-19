// ==================== SIDEBAR & NAVIGATION ====================
function showPage(pageId, element, e) {
    if (e && e.preventDefault) e.preventDefault();
    else if (window.event && window.event.preventDefault) window.event.preventDefault();
    
    if (window.innerWidth < 1024) { document.getElementById('sidebar').classList.add('-translate-x-full'); }
    
    document.querySelectorAll('.page-content').forEach(page => page.classList.remove('active'));
    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add('active');
    
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
    if (element) element.classList.add('active');
    
    const mobileTitle = document.getElementById('page-title-mobile');
    if (mobileTitle && element) mobileTitle.innerText = element.querySelector('span:last-child').innerText;

    // Load page-specific data
    if (pageId === 'dashboard') loadDashboardData();
    if (pageId === 'users') fetchAndRenderUsers();
    if (pageId === 'customers') fetchAndRender('/customers', 'tbody-customers', ['name', 'phone', 'email', 'address']);
    if (pageId === 'work-orders') fetchAndRenderWorkOrders();
    if (pageId === 'buildings') { fetchAndRender('/buildings', 'tbody-buildings', ['name', 'city', 'emirate']); fetchAndRenderFlats(); }
    if (pageId === 'amc') fetchAndRender('/amc', 'tbody-amc', ['contractNumber', 'value', 'status']);
    if (pageId === 'invoices') fetchAndRenderInvoices();
    if (pageId === 'receipts') fetchAndRenderReceipts();
    if (pageId === 'payments') fetchAndRenderPayments();
    if (pageId === 'expenses') fetchAndRender('/expenses', 'tbody-expenses', ['category', 'amount', 'status']);
    if (pageId === 'purchases') fetchAndRenderPurchases();
    if (pageId === 'po') fetchAndRender('/po', 'tbody-po', ['poNumber', 'supplierName', 'total']);
    if (pageId === 'inventory') fetchAndRenderAssets();
    if (pageId === 'staff') fetchAndRenderStaff();
    if (pageId === 'reports') loadReports();
    if (pageId === 'company') loadCompanySettings();
    if (pageId === 'settings') loadSystemSettings();
}

// ==================== RBAC: Role-Based Access Control ====================
document.addEventListener('DOMContentLoaded', () => {
    const role = (typeof userRole !== 'undefined') ? userRole : 'SUPER_ADMIN';
    
    document.querySelectorAll('.sidebar-link').forEach(link => {
        const allowedRoles = link.getAttribute('data-roles');
        if (allowedRoles) {
            const roles = allowedRoles.split(',').map(r => r.trim().toUpperCase());
            const upperRole = role.toUpperCase();
            if (!roles.includes(upperRole) && upperRole !== 'SUPER_ADMIN' && upperRole !== 'ADMIN') {
                link.style.display = 'none';
            }
        }
    });
    
    // Generate calendar on load
    if (typeof generateMiniCalendar === 'function') generateMiniCalendar();
    
    // Highlight selected template
    if (typeof highlightSelectedTemplate === 'function') highlightSelectedTemplate();

    // Trigger initial data load for the dashboard
    const initialActiveLink = document.querySelector('.sidebar-link.active');
    if (initialActiveLink) {
        showPage('dashboard', initialActiveLink, null);
    }
});
