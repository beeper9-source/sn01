// Supabase 설정 파일
// 실제 사용 시에는 아래 값들을 Supabase 프로젝트에서 가져온 값으로 교체하세요

const SUPABASE_CONFIG = {
    // Supabase 프로젝트 URL (예: https://your-project-id.supabase.co)
    url: 'https://dmgtwzbvpualecnrcyug.supabase.co',
    
    // Supabase anon public key
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZ3R3emJ2cHVhbGVjbnJjeXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMzAzODUsImV4cCI6MjA3MjcwNjM4NX0.Cddfcij0GL3lLCZz51tALcyKULfGECyq4YNpjVh9Uf4'
};

// Supabase 클라이언트 인스턴스 (SDK 전역 'supabase'와 이름 충돌 방지)
let supabaseClientInstance = null;

function initializeSupabase() {
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        supabaseClientInstance = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('[Supabase] [config] 클라이언트 생성 완료', { url: SUPABASE_CONFIG.url });
        return true;
    }
    console.warn('[Supabase] [config] createClient 불가 - window.supabase 미로드');
    return false;
}

// SDK 로드 대기 폴링 (CDN 지연 대응)
function waitForSupabaseSDK(maxWaitMs, intervalMs) {
    const start = Date.now();
    return new Promise(function check(resolve) {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            resolve(true);
            return;
        }
        if (Date.now() - start >= maxWaitMs) {
            console.error('[Supabase] [config] SDK 대기 시간 초과 (' + maxWaitMs + 'ms)');
            resolve(false);
            return;
        }
        setTimeout(function() { check(resolve); }, intervalMs);
    });
}

// 즉시 초기화 시도
if (!initializeSupabase()) {
    (function retryInit() {
        waitForSupabaseSDK(8000, 300).then(function(ready) {
            if (ready && !supabaseClientInstance) {
                if (initializeSupabase()) {
                    console.log('[Supabase] [config] 폴링 후 클라이언트 생성 완료');
                    try { window.dispatchEvent(new CustomEvent('supabaseReady', { detail: { client: supabaseClientInstance } })); } catch (e) {}
                }
            }
        });
    })();
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
        return supabaseClientInstance;
    }
});
window.validateSupabaseConfig = validateSupabaseConfig;

