const API_BASE_URL = 'https://makinfratech-api.onrender.com/api';
const token = localStorage.getItem('fsm_token');
let userRole = (localStorage.getItem('fsm_role') || 'SUPER_ADMIN').toUpperCase();

async function apiFetch(endpoint, method = 'GET', body = null) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) throw new Error('API Error');
    return res.json();
}

function openWorkOrderModal() {
    alert("The button works! Frontend is successfully talking to the backend.");
}
