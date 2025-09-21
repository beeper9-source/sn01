// Supabase 설정 파일
// 실제 사용 시에는 아래 값들을 Supabase 프로젝트에서 가져온 값으로 교체하세요

const SUPABASE_CONFIG = {
    // Supabase 프로젝트 URL (예: https://your-project-id.supabase.co)
    url: 'https://dmgtwzbvpualecnrcyug.supabase.co',
    
    // Supabase anon public key
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZ3R3emJ2cHVhbGVjbnJjeXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMzAzODUsImV4cCI6MjA3MjcwNjM4NX0.Cddfcij0GL3lLCZz51tALcyKULfGECyq4YNpjVh9Uf4'
};

// Supabase 클라이언트 초기화 (안전한 초기화)
let supabase = null;

function initializeSupabase() {
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('Supabase 클라이언트 초기화 완료');
        return true;
    } else {
        console.warn('Supabase 라이브러리가 아직 로드되지 않았습니다.');
        return false;
    }
}

// 즉시 초기화 시도
if (!initializeSupabase()) {
    // DOM이 로드된 후 재시도
    document.addEventListener('DOMContentLoaded', function() {
        if (!initializeSupabase()) {
            // Supabase 라이브러리 로드 대기 후 재시도
            setTimeout(() => {
                if (initializeSupabase()) {
                    console.log('Supabase 클라이언트 지연 초기화 완료');
                } else {
                    console.error('Supabase 클라이언트 초기화 실패');
                }
            }, 500);
        }
    });
}

// 설정 검증 함수
function validateSupabaseConfig() {
    if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL_HERE' || 
        SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY_HERE') {
        console.error('Supabase 설정이 완료되지 않았습니다. supabase-config.js 파일을 확인하세요.');
        return false;
    }
    return true;
}

// 전역으로 사용할 수 있도록 export (getter 함수 사용)
Object.defineProperty(window, 'supabaseClient', {
    get: function() {
        return supabase;
    }
});
window.validateSupabaseConfig = validateSupabaseConfig;

