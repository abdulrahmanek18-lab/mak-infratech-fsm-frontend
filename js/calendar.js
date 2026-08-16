// ==================== CALENDAR ====================
let calendarDate = new Date();

function changeMonth(delta) {
    calendarDate.setMonth(calendarDate.getMonth() + delta);
    generateMiniCalendar();
}

function generateMiniCalendar() {
    const cal = document.getElementById('mini-calendar');
    const ml = document.getElementById('calendar-month-label');
    if (!cal || !ml) return;
    
    const y = calendarDate.getFullYear(), m = calendarDate.getMonth();
    const fd = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const t = new Date();
    
    ml.innerText = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let html = '';
    
    // Empty cells for days before the 1st
    for (let i = 0; i < fd; i++) {
        html += `<div class="text-center text-xs text-gray-300 p-1"></div>`;
    }
    
    // Days 1-31
    for (let i = 1; i <= dim; i++) {
        const isToday = i === t.getDate() && m === t.getMonth() && y === t.getFullYear();
        const todayClass = isToday ? 'cal-day today' : 'cal-day';
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        // Check for scheduled events
        let dotsHtml = '';
        const dayEvents = (dashboardData.wos || []).filter(wo => {
            if (!wo.scheduledDate) return false;
            const d = new Date(wo.scheduledDate);
            return d.getFullYear() === y && d.getMonth() === m && d.getDate() === i;
        });
        
        if (dayEvents.length > 0) {
            const colors = ['bg-blue-500', 'bg-orange-500', 'bg-purple-500', 'bg-green-500'];
            dotsHtml = '<div class="flex justify-center gap-0.5">';
            dayEvents.slice(0, 4).forEach((e, idx) => {
                dotsHtml += `<div class="cal-day-dot ${colors[idx % colors.length]}"></div>`;
            });
            dotsHtml += '</div>';
        }
        
        html += `<div class="${todayClass}" onclick="selectCalendarDate('${dateStr}')">${i}${dotsHtml}</div>`;
    }
    
    cal.innerHTML = html;
    
    // Auto-select today on initial load
    if (m === t.getMonth() && y === t.getFullYear()) {
        selectCalendarDate(`${y}-${String(m + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`);
    }
}

function selectCalendarDate(dateStr) {
    const date = new Date(dateStr);
    const label = document.getElementById('schedule-date-label');
    const feed = document.getElementById('daily-schedule-feed');
    if (!label || !feed) return;
    
    label.innerHTML = `Schedule for ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} <button onclick="openWorkOrderModal('${dateStr}')" class="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700">+ Schedule</button>`;
    
    const dayJobs = (dashboardData.wos || []).filter(wo => {
        if (!wo.scheduledDate) return false;
        const d = new Date(wo.scheduledDate);
        return d.toDateString() === date.toDateString();
    });

    if (dayJobs.length === 0) {
        feed.innerHTML = `<div class="text-gray-400 text-center py-4">No jobs scheduled.</div>`;
    } else {
        feed.innerHTML = dayJobs.map(job => {
            const time = new Date(job.scheduledDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            return `<div class="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div class="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-1 rounded">${time}</div>
                <div>
                    <div class="text-sm text-gray-800 font-medium">${job.title}</div>
                    <div class="text-xs text-gray-500">${job.building?.name || '-'} ${job.flat?.unitNumber ? '('+job.flat.unitNumber+')' : ''}</div>
                </div>
            </div>`;
        }).join('');
    }
}
