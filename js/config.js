const SUPABASE_URL = 'https://wkjxohnhhgenfvxiorkh.supabase.co';
const SUPABASE_ANON_KEY = 'EyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndranhvaG5oaGdlbmZ2eGlvcmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDI4MTgsImV4cCI6MjEwNTY3ODgxOH0.j5oNNjLnnmM0e-ltWftL09R9rMKaIQ6dyliE_aytTc8';

let supabaseClient = null;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const DAYS = [
    { key: 'Sen', full: 'SENIN', index: 1 },
    { key: 'Sel', full: 'SELASA', index: 2 },
    { key: 'Rab', full: 'RABU', index: 3 },
    { key: 'Kam', full: 'KAMIS', index: 4 },
    { key: 'Jum', full: 'JUMAT', index: 5 },
    { key: 'Sab', full: 'SABTU', index: 6 },
    { key: 'Min', full: 'MINGGU', index: 0 }
];

function getTodayKey() {
    const dayNum = new Date().getDay();
    const found = DAYS.find(d => d.index === dayNum);
    return found ? found.key : 'Sen';
}

function getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
