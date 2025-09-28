// 악보 데이터
let sheetMusicList = [
    { id: 1, title: 'Canon in D', composer: 'Pachelbel', arranger: '', genre: '클래식', difficulty: '중급', notes: '체임버앙상블 기본 레퍼토리', files: [] },
    { id: 2, title: 'Four Seasons - Spring', composer: 'Vivaldi', arranger: '', genre: '클래식', difficulty: '고급', notes: '바이올린 솔로 포함', files: [] },
    { id: 3, title: 'Yesterday', composer: 'Paul McCartney', arranger: 'John Lennon', genre: '팝', difficulty: '초급', notes: '비틀즈 명곡', files: [] }
];

// 멤버 데이터 (list.txt에서 가져온 정보)
const members = [
    { no: 2, instrument: '피아노', name: '김희선' },
    { no: 3, instrument: '바이올린', name: '김효식' },
    { no: 4, instrument: '바이올린', name: '목진혜' },
    { no: 5, instrument: '바이올린', name: '성지윤' },
    { no: 6, instrument: '바이올린', name: '나무홍' },
    { no: 7, instrument: '첼로', name: '조유진' },
    { no: 8, instrument: '첼로', name: '김진희' },
    { no: 9, instrument: '첼로', name: '이령' },
    { no: 10, instrument: '첼로', name: '이정헌' },
    { no: 11, instrument: '첼로', name: '김구' },
    { no: 12, instrument: '클라리넷', name: '노동일' },
    { no: 13, instrument: '클라리넷', name: '조원양' },
    { no: 14, instrument: '클라리넷', name: '신세연' },
    { no: 15, instrument: '클라리넷', name: '이상규' },
    { no: 16, instrument: '클라리넷', name: '이인섭' },
    { no: 17, instrument: '플룻', name: '김병민' },
    { no: 18, instrument: '플룻', name: '허진희' },
    { no: 19, instrument: '플룻', name: '민휘' },
    { no: 20, instrument: '플룻', name: '문세린' }
];

// 출석 상태 타입
const ATTENDANCE_TYPES = {
    PRESENT: 'present',
    ABSENT: 'absent',
    PENDING: 'pending',
    HOLIDAY: 'holiday'
};

// 휴강일 설정
const HOLIDAY_SESSIONS = [5, 6]; // 5회차, 6회차 휴강

// 출석 데이터 저장소 (Supabase 사용)
class AttendanceManager {
    constructor() {
        this.storageKey = 'chamber_attendance_local'; // 로컬 백업용
        this.data = this.loadData();
        this.isOnline = navigator.onLine;
        this.lastSyncTime = 0;
        this.syncInterval = null;
        
        // Supabase 클라이언트 확인 (안전한 접근)
        this.checkSupabaseConnection();
    }

    checkSupabaseConnection() {
        // window.supabaseClient가 있는지 확인
        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null) {
            this.supabase = window.supabaseClient;
            console.log('Supabase 클라이언트 연결 완료');
            this.setupCloudSync();
        } else {
            console.log('Supabase 클라이언트가 로드되지 않았습니다. 로컬 모드로 작동합니다.');
            this.supabase = null;
            
            // 잠시 후 다시 시도 (Supabase 로딩 완료 대기)
            setTimeout(() => {
                if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null) {
                    this.supabase = window.supabaseClient;
                    console.log('Supabase 클라이언트 지연 연결 완료');
                    this.setupCloudSync();
                }
            }, 500);
        }
    }

    loadData() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('데이터 로드 실패:', e);
            }
        }
        return {};
    }

    saveData() {
        // 로컬스토리지에 저장
        const localSuccess = this.saveToLocal();
        
        // Supabase에 저장 (온라인인 경우)
        let cloudSuccess = true;
        if (this.isOnline && this.supabase) {
            cloudSuccess = this.saveToCloud();
        }
        
        return localSuccess && cloudSuccess;
    }

    getAttendance(session, memberNo) {
        // 휴강일인 경우 휴강 상태 반환
        if (HOLIDAY_SESSIONS.includes(session)) {
            return ATTENDANCE_TYPES.HOLIDAY;
        }
        
        const attendanceData = this.data[session]?.[memberNo];
        if (!attendanceData) {
            return ATTENDANCE_TYPES.PENDING;
        }
        
        // 기존 형식 (문자열)과 새로운 형식 (객체) 모두 지원
        if (typeof attendanceData === 'string') {
            return attendanceData;
        } else if (typeof attendanceData === 'object' && attendanceData.status) {
            return attendanceData.status;
        }
        
        return ATTENDANCE_TYPES.PENDING;
    }
    
    // 출석 상태와 타임스탬프를 함께 반환하는 함수
    getAttendanceWithTimestamp(session, memberNo) {
        // 휴강일인 경우 휴강 상태 반환
        if (HOLIDAY_SESSIONS.includes(session)) {
            return {
                status: ATTENDANCE_TYPES.HOLIDAY,
                timestamp: null
            };
        }
        
        const attendanceData = this.data[session]?.[memberNo];
        if (!attendanceData) {
            return {
                status: ATTENDANCE_TYPES.PENDING,
                timestamp: null
            };
        }
        
        // 기존 형식 (문자열)과 새로운 형식 (객체) 모두 지원
        if (typeof attendanceData === 'string') {
            return {
                status: attendanceData,
                timestamp: null
            };
        } else if (typeof attendanceData === 'object' && attendanceData.status) {
            return {
                status: attendanceData.status,
                timestamp: attendanceData.timestamp
            };
        }
        
        return {
            status: ATTENDANCE_TYPES.PENDING,
            timestamp: null
        };
    }

    async setAttendance(session, memberNo, status) {
        // 휴강일인 경우 출석 상태 변경 불가
        if (HOLIDAY_SESSIONS.includes(session)) {
            return false;
        }
        
        if (!this.data[session]) {
            this.data[session] = {};
        }
        
        // 출석 상태와 타임스탬프 저장
        this.data[session][memberNo] = {
            status: status,
            timestamp: new Date().toISOString()
        };
        
        // 로컬 저장
        this.saveToLocal();
        
        // Supabase에 즉시 저장
        if (this.isOnline && this.supabase) {
            try {
                // 멤버 id 매핑 확보
                let supabaseId = await mapMemberNoToSupabaseId(parseInt(memberNo));
                if (!supabaseId) {
                    await ensureMemberInSupabase(memberNo);
                    supabaseId = await mapMemberNoToSupabaseId(parseInt(memberNo));
                }
                if (!supabaseId) {
                    console.error('멤버 ID 매핑 실패로 출석 저장 불가');
                } else {
                    const { error: upsertError } = await this.supabase
                        .from('attendance_records')
                        .upsert({
                            member_id: supabaseId,
                            session_number: session,
                            status: status
                        }, { onConflict: 'session_number,member_id' });
                    if (upsertError) {
                        console.error('Supabase 출석 상태 저장 실패:', upsertError);
                    } else {
                        console.log('Supabase 출석 상태 저장 완료(업서트)');
                    }
                }
            } catch (error) {
                console.error('Supabase 출석 상태 저장 오류:', error);
            }
        }
        
        // 동기화 시간 업데이트
        this.updateSyncTime();
        
        this.notifyChange(session, memberNo, status);
        return true;
    }

    getSessionSummary(session) {
        const sessionData = this.data[session] || {};
        const summary = {
            present: 0,
            absent: 0,
            pending: 0,
            holiday: 0
        };

        // 휴강일인 경우 모든 멤버를 휴강으로 처리
        if (HOLIDAY_SESSIONS.includes(session)) {
            summary.holiday = members.length;
            return summary;
        }

        members.forEach(member => {
            const attendanceData = sessionData[member.no];
            let status;
            
            if (!attendanceData) {
                status = ATTENDANCE_TYPES.PENDING;
            } else if (typeof attendanceData === 'string') {
                status = attendanceData;
            } else if (typeof attendanceData === 'object' && attendanceData.status) {
                status = attendanceData.status;
            } else {
                status = ATTENDANCE_TYPES.PENDING;
            }
            
            summary[status]++;
        });

        return summary;
    }

    getInstrumentSummary(session) {
        const sessionData = this.data[session] || {};
        const instrumentSummary = {};

        // 악기별로 초기화
        const instruments = ['바이올린', '첼로', '플룻', '클라리넷', '피아노'];
        instruments.forEach(instrument => {
            instrumentSummary[instrument] = {
                present: 0,
                absent: 0,
                pending: 0,
                holiday: 0,
                total: 0
            };
        });

        // 휴강일인 경우 모든 멤버를 휴강으로 처리
        if (HOLIDAY_SESSIONS.includes(session)) {
            members.forEach(member => {
                instrumentSummary[member.instrument].holiday++;
                instrumentSummary[member.instrument].total++;
            });
            return instrumentSummary;
        }

        // 각 멤버의 출석 상태를 악기별로 집계
        members.forEach(member => {
            const attendanceData = sessionData[member.no];
            let status;
            
            if (!attendanceData) {
                status = ATTENDANCE_TYPES.PENDING;
            } else if (typeof attendanceData === 'string') {
                status = attendanceData;
            } else if (typeof attendanceData === 'object' && attendanceData.status) {
                status = attendanceData.status;
            } else {
                status = ATTENDANCE_TYPES.PENDING;
            }
            
            instrumentSummary[member.instrument][status]++;
            instrumentSummary[member.instrument].total++;
        });

        return instrumentSummary;
    }

    setupCloudSync() {
        // Supabase를 사용한 클라우드 동기화
        console.log('Supabase 클라우드 동기화 설정');
        
        if (!this.supabase) {
            console.log('Supabase 클라이언트가 없어 로컬 모드로 작동합니다.');
            this.updateSyncStatus('offline', '로컬 모드 (Supabase 연결 없음)');
            return;
        }
        
        // 초기 동기화 (페이지 로드 시)
        if (this.isOnline) {
            setTimeout(() => {
                this.loadFromCloud();
            }, 2000);
        }
        
        // 주기적으로 클라우드에서 데이터 동기화 (30초마다)
        this.syncInterval = setInterval(() => {
            if (this.isOnline && this.supabase) {
                console.log('자동 동기화 실행 중...');
                this.updateSyncStatus('syncing', '동기화 중...');
                this.loadFromCloud();
            } else {
                console.log('오프라인 상태 또는 Supabase 연결 없음 - 동기화 건너뜀');
                this.updateSyncStatus('offline', '오프라인 상태');
            }
        }, 30000);
    }

    async saveToCloud() {
        if (!this.isOnline || !this.supabase) {
            console.log('오프라인 상태 또는 Supabase 연결 없음 - 클라우드 저장 건너뜀');
            this.updateSyncStatus('offline', '오프라인 상태');
            return false;
        }

        try {
            console.log('Supabase에 데이터 저장 시도...');
            
            // 출석 데이터를 Supabase 형식으로 변환 (FK: attendance_records.member_id -> members.id)
            const attendanceRecords = [];
            for (const [session, sessionData] of Object.entries(this.data)) {
                for (const [memberNo, attendanceData] of Object.entries(sessionData)) {
                    const supabaseId = await mapMemberNoToSupabaseId(parseInt(memberNo));
                    if (supabaseId) {
                        // 기존 형식 (문자열)과 새로운 형식 (객체) 모두 지원
                        let status;
                        if (typeof attendanceData === 'string') {
                            status = attendanceData;
                        } else if (typeof attendanceData === 'object' && attendanceData.status) {
                            status = attendanceData.status;
                        } else {
                            continue; // 잘못된 형식은 건너뜀
                        }
                        
                        attendanceRecords.push({
                            member_id: supabaseId,
                            session_number: parseInt(session),
                            status: status
                        });
                    }
                }
            }

            if (attendanceRecords.length > 0) {
                // 업서트로 중복 충돌 방지
                for (const record of attendanceRecords) {
                    try {
                        const { error: upsertError } = await this.supabase
                            .from('attendance_records')
                            .upsert(record, { onConflict: 'session_number,member_id' });
                        if (upsertError) {
                            console.error('레코드 업서트 실패:', upsertError);
                        }
                    } catch (error) {
                        console.error('레코드 업서트 처리 오류:', error);
                    }
                }
            }

            console.log('Supabase에 데이터 저장 완료');
            this.lastSyncTime = Date.now();
            this.updateSyncStatus('online', '동기화 완료');
            this.updateSyncTime();
            
            // 로컬에도 저장
            this.saveToLocal();
            return true;
        } catch (error) {
            console.error('Supabase 저장 오류:', error);
            this.updateSyncStatus('offline', '네트워크 오류: ' + error.message);
            return false;
        }
    }

    async loadFromCloud() {
        if (!this.isOnline || !this.supabase) {
            console.log('오프라인 상태 또는 Supabase 연결 없음 - 클라우드 로드 건너뜀');
            return false;
        }

        try {
            console.log('Supabase에서 데이터 로드 시도...');
            
            const { data, error } = await this.supabase
                .from('attendance_records')
                .select('session_number, member_id, status, updated_at');

            if (error) {
                console.error('Supabase 로드 실패:', error);
                this.updateSyncStatus('offline', '동기화 실패');
                return false;
            }

            if (data) {
                // Supabase 데이터를 로컬 형식으로 변환
                const cloudData = {};
                data.forEach(record => {
                    if (!cloudData[record.session_number]) {
                        cloudData[record.session_number] = {};
                    }
                    // 역매핑: members.id -> members.no 필요
                    const memberNo = reverseMapSupabaseIdToMemberNo(record.member_id);
                    if (memberNo) {
                        // updated_at이 있으면 객체 형식으로, 없으면 문자열 형식으로 저장
                        if (record.updated_at) {
                            cloudData[record.session_number][memberNo] = {
                                status: record.status,
                                timestamp: record.updated_at
                            };
                        } else {
                            cloudData[record.session_number][memberNo] = record.status;
                        }
                    }
                });
                
                console.log('클라우드 데이터:', cloudData);
                console.log('로컬 데이터:', this.data);
                
                if (JSON.stringify(cloudData) !== JSON.stringify(this.data)) {
                    console.log('Supabase에서 데이터 업데이트 감지 - UI 업데이트');
                    this.data = cloudData;
                    this.saveToLocal();
                    this.notifyUIUpdate();
                    this.updateSyncStatus('online', '데이터 업데이트됨');
                    this.updateSyncTime();
                } else {
                    console.log('데이터 변경 없음');
                    this.updateSyncStatus('online', '동기화 완료');
                }
                this.lastSyncTime = Date.now();
                return true;
            }
        } catch (error) {
            console.error('Supabase 로드 오류:', error);
            this.updateSyncStatus('offline', '네트워크 오류');
            return false;
        }
    }

    async createNewBin() {
        try {
            console.log('새로운 JSONBin.io Bin 생성 시도...');
            
            const response = await fetch(this.createBinUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.jsonBinApiKey
                },
                body: JSON.stringify(this.data)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('새로운 Bin 생성 완료:', result);
                
                // 새로운 Bin ID로 업데이트
                this.jsonBinId = result.metadata.id;
                this.jsonBinUrl = `https://api.jsonbin.io/v3/b/${this.jsonBinId}`;
                
                // 로컬스토리지에 새로운 Bin ID 저장
                localStorage.setItem('jsonBinId', this.jsonBinId);
                
                this.updateSyncStatus('online', '새 Bin 생성 완료');
                return true;
            } else {
                const errorData = await response.text();
                console.error('Bin 생성 실패:', response.status, errorData);
                this.updateSyncStatus('offline', 'Bin 생성 실패');
                return false;
            }
        } catch (error) {
            console.error('Bin 생성 오류:', error);
            this.updateSyncStatus('offline', 'Bin 생성 오류');
            return false;
        }
    }

    notifyOtherTabs() {
        // 다른 탭에 변경사항 알림
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('attendance_sync');
            channel.postMessage({
                type: 'data_updated',
                timestamp: Date.now()
            });
            channel.close();
        }
    }

    saveToLocal() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            return true;
        } catch (e) {
            console.error('로컬 저장 실패:', e);
            return false;
        }
    }

    notifyUIUpdate() {
        // UI 업데이트를 위한 이벤트 발생
        window.dispatchEvent(new CustomEvent('attendanceDataUpdated'));
    }

    updateSyncStatus(status, message) {
        const indicator = document.getElementById('syncIndicator');
        const text = document.getElementById('syncText');
        
        if (indicator && text) {
            indicator.className = `sync-indicator ${status}`;
            text.textContent = message;
        }
    }

    updateSyncTime() {
        const syncTimeElement = document.getElementById('syncTimeValue');
        if (syncTimeElement) {
            // 출석부 데이터에서 가장 늦은 업데이트 시간과 멤버 찾기
            let latestUpdateTime = null;
            let latestMemberNo = null;
            
            // 모든 세션의 출석 데이터를 확인
            for (const session in this.data) {
                for (const memberNo in this.data[session]) {
                    const attendanceData = this.data[session][memberNo];
                    if (attendanceData && attendanceData.timestamp) {
                        const updateTime = new Date(attendanceData.timestamp);
                        if (!latestUpdateTime || updateTime > latestUpdateTime) {
                            latestUpdateTime = updateTime;
                            latestMemberNo = memberNo;
                        }
                    }
                }
            }
            
            // 가장 늦은 업데이트 시간이 있으면 표시, 없으면 현재 시간 표시
            const displayTime = latestUpdateTime || new Date();
            const timeString = displayTime.toLocaleString('ko-KR', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit'
            });
            
            // 멤버 이름 찾기
            let memberInfo = '';
            if (latestMemberNo) {
                const member = members.find(m => m.no === parseInt(latestMemberNo));
                if (member) {
                    memberInfo = ` (${member.name})`;
                }
            }
            
            syncTimeElement.textContent = `마지막 출석체크 : ${timeString}${memberInfo}`;
        }
    }

    notifyChange(session, memberNo, status) {
        // 다른 탭이나 창에 변경사항 알림
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('attendance_channel');
            channel.postMessage({
                type: 'attendance_change',
                session,
                memberNo,
                status,
                timestamp: Date.now()
            });
            channel.close();
        }
    }

    listenForChanges(callback) {
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('attendance_channel');
            channel.onmessage = (event) => {
                if (event.data.type === 'attendance_change') {
                    callback(event.data);
                }
            };
            return channel;
        }
        return null;
    }
}

// 전역 출석 관리자 인스턴스
const attendanceManager = new AttendanceManager();

// DOM 요소들
let currentSession = 1;
let changeChannel = null;

// 회원 관리 관련 변수
let editingMemberId = null;
let nextMemberId = 21; // 다음 회원 ID (기존 멤버는 2-20번 사용 중)
// Supabase FK 매핑: members.no -> members.id
const memberNoToSupabaseId = {};

// member.no -> members.id 매핑 함수 (캐시 + 조회)
async function mapMemberNoToSupabaseId(memberNo) {
    if (memberNoToSupabaseId[memberNo]) return memberNoToSupabaseId[memberNo];
    try {
        if (!attendanceManager.isOnline || !attendanceManager.supabase) return null;
        const { data } = await attendanceManager.supabase
            .from('members')
            .select('id')
            .eq('no', memberNo)
            .maybeSingle();
        if (data && data.id) {
            memberNoToSupabaseId[memberNo] = data.id;
            return data.id;
        }
    } catch {}
    return null;
}

function reverseMapSupabaseIdToMemberNo(memberId) {
    // 먼저 캐시에서 찾기
    const cachedNo = Object.keys(memberNoToSupabaseId).find(no => memberNoToSupabaseId[no] === memberId);
    if (cachedNo) return parseInt(cachedNo);
    // members 배열에서 찾기: id 정보를 직접 갖고 있지 않으므로 추정 불가 → 보수적으로 무시
    // 향후 필요하면 members.id를 함께 보관하도록 확장 가능
    return null;
}

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setupPracticeSongEventListeners();
    startRealTimeSync();
});

function initializeApp() {
    // 회원 데이터 로드 (저장된 데이터가 있으면 사용)
    loadMembersFromStorage();
    
    // 악보 데이터 로드
    loadSheetMusicFromStorage();
    
    // 연습곡 데이터 로드
    loadPracticeSongsFromStorage();
    
    // Supabase에서 악보 데이터 로드
    if (attendanceManager.isOnline && attendanceManager.supabase) {
        loadSheetMusicFromSupabase().then((loaded) => {
            if (loaded) {
                renderSheetMusicList();
            }
        });
        
        // Supabase에서 연습곡 데이터 로드
        loadPracticeSongsFromSupabase().then((loaded) => {
            if (loaded) {
                console.log('연습곡 데이터 Supabase 로드 완료');
            }
        });
    }
    // 가능하면 Supabase에서 최신 멤버 목록 로드
    loadMembersFromSupabase().then((loaded) => {
        if (loaded) {
            // Supabase 로드 후 기본 멤버 보정 (예: 문세린)
            ensureDefaultMembers();
            renderMemberList();
            updateSummary();
        }
    });
    ensureDefaultMembers();
    
    renderMemberList();
    updateSummary();
    updateSessionDates();
    updateInstrumentMemberCounts();
    
    // 회차 선택 기본값 설정
    setDefaultSession();
    
    // 동기화 상태 초기화
    attendanceManager.updateSyncStatus('online', '동기화 준비됨');
    attendanceManager.updateSyncTime();
    
    // 데이터 업데이트 이벤트 리스너
    window.addEventListener('attendanceDataUpdated', function() {
        renderMemberList();
        updateSummary();
    });
}

// 기본 멤버가 누락된 경우 추가 (마이그레이션 성격)
function ensureDefaultMembers() {
    const requiredMembers = [
        { no: 20, instrument: '플룻', name: '문세린' }
    ];

    let changed = false;

    requiredMembers.forEach(req => {
        const exists = members.some(m => m.no === req.no || (m.name === req.name && m.instrument === req.instrument));
        if (!exists) {
            members.push({ no: req.no, instrument: req.instrument, name: req.name });
            changed = true;
        }
    });

    if (changed) {
        // nextMemberId 갱신 및 저장
        const maxId = Math.max(...members.map(m => m.no));
        nextMemberId = maxId + 1;
        saveMembersToStorage();
        // 온라인이면 Supabase에도 반영
        if (attendanceManager.isOnline && attendanceManager.supabase) {
            requiredMembers.forEach(req => {
                const exists = members.some(m => m.no === req.no);
                if (exists) {
                    upsertMemberToSupabase(req);
                }
            });
        }
    }
}

function setupEventListeners() {
    // 회차 선택 이벤트
    const sessionSelect = document.getElementById('sessionSelect');
    if (sessionSelect) {
        sessionSelect.addEventListener('change', function() {
            currentSession = parseInt(this.value);
            renderMemberList();
            updateSummary();
        });
    }

    // 저장 및 동기화 버튼 이벤트 (버튼이 존재하는 경우에만)
    const saveSyncBtn = document.getElementById('saveSyncBtn');
    if (saveSyncBtn) {
        saveSyncBtn.addEventListener('click', saveAndSync);
    }

    // 회원 관리 관련 이벤트 리스너
    setupMemberManagementEvents();
}

// 멤버를 악기별로 그룹화하고 각 악기 내에서 이름을 가나다순으로 정렬
function getSortedMembers() {
    // 악기 순서 정의
    const instrumentOrder = ['바이올린', '첼로', '플룻', '클라리넷', '피아노'];
    
    // 악기별로 멤버 그룹화
    const membersByInstrument = {};
    members.forEach(member => {
        if (!membersByInstrument[member.instrument]) {
            membersByInstrument[member.instrument] = [];
        }
        membersByInstrument[member.instrument].push(member);
    });
    
    // 각 악기 내에서 이름을 가나다순으로 정렬
    Object.keys(membersByInstrument).forEach(instrument => {
        membersByInstrument[instrument].sort((a, b) => {
            return a.name.localeCompare(b.name, 'ko-KR');
        });
    });
    
    // 정의된 악기 순서대로 정렬된 멤버 배열 생성
    const sortedMembers = [];
    instrumentOrder.forEach(instrument => {
        if (membersByInstrument[instrument]) {
            sortedMembers.push(...membersByInstrument[instrument]);
        }
    });
    
    return sortedMembers;
}

function renderMemberList() {
    const memberList = document.getElementById('memberList');
    memberList.innerHTML = '';

    // 정렬된 멤버 목록 가져오기
    const sortedMembers = getSortedMembers();
    
    sortedMembers.forEach(member => {
        const memberElement = createMemberElement(member);
        memberList.appendChild(memberElement);
    });
}

function createMemberElement(member) {
    const div = document.createElement('div');
    div.className = 'member-item';
    div.dataset.memberNo = member.no;

    const attendanceData = attendanceManager.getAttendanceWithTimestamp(currentSession, member.no);
    const currentStatus = attendanceData.status;
    const timestamp = attendanceData.timestamp;
    const isHoliday = HOLIDAY_SESSIONS.includes(currentSession);

    // 타임스탬프 포맷팅 함수
    function formatTimestamp(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit'
        });
    }

    if (isHoliday) {
        // 휴강일인 경우 휴강 상태로 표시하고 버튼 비활성화
        div.innerHTML = `
            <div class="member-info">
                <div class="member-name">${member.name}</div>
                <div class="member-instrument">${member.instrument}</div>
            </div>
            <div class="attendance-buttons">
                <button class="attendance-btn holiday active" disabled>휴강</button>
            </div>
            <div class="timestamp-info">
                <span class="timestamp">${formatTimestamp(timestamp)}</span>
            </div>
        `;
    } else {
        // 일반 수업일인 경우
        div.innerHTML = `
            <div class="member-info">
                <div class="member-name">${member.name}</div>
                <div class="member-instrument">${member.instrument}</div>
            </div>
            <div class="attendance-buttons">
                <button class="attendance-btn present ${currentStatus === ATTENDANCE_TYPES.PRESENT ? 'active' : ''}" 
                        data-status="${ATTENDANCE_TYPES.PRESENT}">출석</button>
                <button class="attendance-btn absent ${currentStatus === ATTENDANCE_TYPES.ABSENT ? 'active' : ''}" 
                        data-status="${ATTENDANCE_TYPES.ABSENT}">결석</button>
                <button class="attendance-btn pending ${currentStatus === ATTENDANCE_TYPES.PENDING ? 'active' : ''}" 
                        data-status="${ATTENDANCE_TYPES.PENDING}">미정</button>
            </div>
            <div class="timestamp-info">
                <span class="timestamp">${formatTimestamp(timestamp)}</span>
            </div>
        `;

        // 출석 버튼 이벤트 리스너
        const buttons = div.querySelectorAll('.attendance-btn');
        buttons.forEach(button => {
            button.addEventListener('click', async function() {
                const status = this.dataset.status;
                const memberNo = parseInt(div.dataset.memberNo);
                
                const success = await attendanceManager.setAttendance(currentSession, memberNo, status);
                if (success) {
                    updateMemberButtons(div, status);
                    updateTimestamp(div, new Date().toISOString());
                    updateSummary();
                }
            });
        });
    }

    return div;
}

function updateMemberButtons(memberElement, activeStatus) {
    const buttons = memberElement.querySelectorAll('.attendance-btn');
    buttons.forEach(button => {
        button.classList.remove('active');
        if (button.dataset.status === activeStatus) {
            button.classList.add('active');
        }
    });
}

function updateTimestamp(memberElement, timestamp) {
    const timestampElement = memberElement.querySelector('.timestamp');
    if (timestampElement) {
        const date = new Date(timestamp);
        const formattedTime = date.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit'
        });
        timestampElement.textContent = formattedTime;
    }
}

function updateSummary() {
    const summary = attendanceManager.getSessionSummary(currentSession);
    const isHoliday = HOLIDAY_SESSIONS.includes(currentSession);
    
    if (isHoliday) {
        // 휴강일인 경우 휴강 집계만 표시
        document.getElementById('attendanceCount').textContent = '0';
        document.getElementById('absenceCount').textContent = '0';
        document.getElementById('pendingCount').textContent = '0';
        document.getElementById('holidayCount').textContent = summary.holiday;
        document.getElementById('holidaySummary').style.display = 'block';
    } else {
        // 일반 수업일인 경우 (13회차 포함)
        document.getElementById('attendanceCount').textContent = summary.present;
        document.getElementById('absenceCount').textContent = summary.absent;
        document.getElementById('pendingCount').textContent = summary.pending;
        document.getElementById('holidaySummary').style.display = 'none';
    }
    
    // 악기별 집계 업데이트
    updateInstrumentSummary();
}

function updateInstrumentSummary() {
    const instrumentSummary = attendanceManager.getInstrumentSummary(currentSession);
    const isHoliday = HOLIDAY_SESSIONS.includes(currentSession);
    
    // 각 악기별로 집계 업데이트
    const instruments = ['바이올린', '첼로', '플룻', '클라리넷', '피아노'];
    
    instruments.forEach(instrument => {
        const instrumentKey = getInstrumentKey(instrument);
        const summary = instrumentSummary[instrument];
        
        if (isHoliday) {
            // 휴강일인 경우 휴강 집계만 표시
            document.getElementById(`${instrumentKey}-present`).textContent = '0';
            document.getElementById(`${instrumentKey}-absent`).textContent = '0';
            document.getElementById(`${instrumentKey}-pending`).textContent = '0';
            document.getElementById(`${instrumentKey}-holiday`).textContent = summary.holiday;
            document.getElementById(`${instrumentKey}-holiday-item`).style.display = 'block';
        } else {
            // 일반 수업일인 경우 (13회차 포함)
            document.getElementById(`${instrumentKey}-present`).textContent = summary.present;
            document.getElementById(`${instrumentKey}-absent`).textContent = summary.absent;
            document.getElementById(`${instrumentKey}-pending`).textContent = summary.pending;
            document.getElementById(`${instrumentKey}-holiday-item`).style.display = 'none';
        }
        
        // 누계출석율 표시
        const rateElement = document.getElementById(`${instrumentKey}-rate`);
        if (rateElement) {
            const cumulativeRate = calculateCumulativeAttendanceRate(instrument);
            rateElement.textContent = `누계출석율: ${cumulativeRate}%`;
        }
    });
}

function getInstrumentKey(instrument) {
    const keyMap = {
        '피아노': 'piano',
        '바이올린': 'violin',
        '첼로': 'cello',
        '클라리넷': 'clarinet',
        '플룻': 'flute'
    };
    return keyMap[instrument];
}

// 악기별 인원수 계산 및 업데이트
function updateInstrumentMemberCounts() {
    const instruments = ['바이올린', '첼로', '플룻', '클라리넷', '피아노'];
    
    instruments.forEach(instrument => {
        const instrumentKey = getInstrumentKey(instrument);
        const countElement = document.getElementById(`${instrumentKey}-count`);
        
        if (countElement) {
            const memberCount = members.filter(member => member.instrument === instrument).length;
            countElement.textContent = `${memberCount}명`;
        }
    });
}

// 누계출석율 계산 함수
function calculateCumulativeAttendanceRate(instrument) {
    const instrumentMembers = members.filter(m => m.instrument === instrument);
    if (instrumentMembers.length === 0) return 0;

    let totalSessions = 0;
    let attendedSessions = 0;

    // 1회차부터 현재 회차까지 모든 세션 확인
    for (let session = 1; session <= currentSession; session++) {
        // 휴강일은 제외
        if (HOLIDAY_SESSIONS.includes(session)) continue;

        totalSessions += instrumentMembers.length;

        // 해당 악기의 모든 멤버의 출석 상태 확인
        instrumentMembers.forEach(member => {
            const status = attendanceManager.getAttendance(session, member.no);
            if (status === ATTENDANCE_TYPES.PRESENT || status === '출석') {
                attendedSessions++;
            }
        });
    }

    if (totalSessions === 0) return 0;
    return Math.round((attendedSessions / totalSessions) * 100);
}

function updateSessionDates() {
    const startDate = new Date('2025-09-07'); // 2025년 9월 7일 일요일
    const sessionSelect = document.getElementById('sessionSelect');
    
    sessionSelect.innerHTML = '';
    
    for (let i = 1; i <= 13; i++) {
        const sessionDate = new Date(startDate);
        sessionDate.setDate(startDate.getDate() + (i - 1) * 7);
        
        const option = document.createElement('option');
        option.value = i;
        
        if (i === 5 || i === 6) {
            // 5회차, 6회차는 휴강으로 표시
            option.textContent = `휴강 (${formatDate(sessionDate)})`;
        } else if (i >= 7) {
            // 7회차부터는 실제 회차 번호를 2씩 빼서 표시 (5회차, 6회차 휴강)
            const actualSession = i - 2;
            option.textContent = `${actualSession}회차 (${formatDate(sessionDate)})`;
        } else {
            option.textContent = `${i}회차 (${formatDate(sessionDate)})`;
        }
        
        sessionSelect.appendChild(option);
    }
}

function formatDate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
}

// 현재 시간이 일요일 저녁 9시 이후인지 확인
function isAfterSunday9PM() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    console.log('=== 시간 확인 디버깅 ===');
    console.log('현재 시간:', now.toLocaleString('ko-KR'));
    console.log('UTC 시간:', now.toUTCString());
    console.log('요일 (0=일요일):', dayOfWeek);
    console.log('시간:', hour);
    console.log('분:', minute);
    console.log('일요일 여부:', dayOfWeek === 0);
    console.log('9시 이후 여부:', hour >= 21);
    
    // 일요일이고 21시(9시) 이후인 경우
    const result = dayOfWeek === 0 && hour >= 21;
    console.log('일요일 저녁 9시 이후 여부:', result);
    console.log('========================');
    
    return result;
}

// 한국 시간대를 고려한 시간 확인 (대안 방법)
function isAfterSunday9PM_KST() {
    const now = new Date();
    
    // 한국 시간대로 변환 (UTC+9)
    const kstOffset = 9 * 60; // 9시간을 분으로 변환
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (kstOffset * 60000));
    
    const dayOfWeek = kst.getDay();
    const hour = kst.getHours();
    
    console.log('=== KST 시간 확인 디버깅 ===');
    console.log('KST 시간:', kst.toLocaleString('ko-KR'));
    console.log('요일 (0=일요일):', dayOfWeek);
    console.log('시간:', hour);
    console.log('일요일 여부:', dayOfWeek === 0);
    console.log('9시 이후 여부:', hour >= 21);
    
    const result = dayOfWeek === 0 && hour >= 21;
    console.log('KST 기준 일요일 저녁 9시 이후 여부:', result);
    console.log('================================');
    
    return result;
}

// 다음주 일요일 회차를 계산
function getNextSundaySession() {
    const now = new Date();
    const startDate = new Date('2025-09-07'); // 2025년 9월 7일 일요일 (1회차)
    
    console.log('=== 회차 계산 디버깅 ===');
    console.log('현재 시간:', now.toLocaleString('ko-KR'));
    console.log('시작일:', startDate.toLocaleString('ko-KR'));
    
    // 현재 날짜가 시작일 이전인 경우 1회차 반환
    if (now < startDate) {
        console.log('시작일 이전 - 1회차 반환');
        return 1;
    }
    
    // 현재 날짜가 종강일 이후인 경우 마지막 회차 반환
    const endDate = new Date('2025-11-30'); // 종강일
    if (now > endDate) {
        console.log('종강일 이후 - 12회차 반환');
        return 12;
    }
    
    // 현재 날짜와 시작일 사이의 주차 계산
    const timeDiff = now.getTime() - startDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const weeksDiff = Math.floor(daysDiff / 7);
    
    console.log('시간 차이 (ms):', timeDiff);
    console.log('일 차이:', daysDiff);
    console.log('주 차이:', weeksDiff);
    
    // 다음주 일요일 회차 (현재 주차 + 1)
    let nextSession = weeksDiff + 2; // +2는 현재 주차 + 1을 의미
    
    console.log('초기 다음 회차:', nextSession);
    
    // 휴강일(5회차, 6회차)을 고려하여 조정
    if (nextSession > 6) {
        nextSession = nextSession + 2; // 휴강일 이후는 회차 번호를 2 증가
        console.log('휴강일 고려 후 회차:', nextSession);
    } else if (nextSession > 5) {
        nextSession = nextSession + 1; // 5회차 휴강만 고려
        console.log('휴강일 고려 후 회차:', nextSession);
    }
    
    // 최대 회차 제한
    if (nextSession > 13) {
        nextSession = 13;
        console.log('최대 회차 제한 적용:', nextSession);
    }
    
    console.log('최종 다음 회차:', nextSession);
    console.log('=======================');
    
    return nextSession;
}

// 회차 선택 기본값 설정
function setDefaultSession() {
    const sessionSelect = document.getElementById('sessionSelect');
    if (!sessionSelect) return;
    
    console.log('=== 회차 기본값 설정 시작 ===');
    
    let defaultSession = 1; // 기본값은 1회차

    // 현재 주간의 일요일 회차를 기본값으로 설정 (월~일 모두 해당 주 일요일)
    const now = new Date();
    const startDate = new Date('2025-09-07'); // 1회차 일요일

    // 이번 주 일요일 계산 (오늘이 일요일이면 오늘)
    const dayOfWeek = now.getDay(); // 0=일
    const daysToSunday = (7 - dayOfWeek) % 7; // 일요일까지 남은 일수
    const thisSunday = new Date(now);
    thisSunday.setDate(now.getDate() + daysToSunday);

    if (thisSunday < startDate) {
        defaultSession = 1;
        console.log('개강 전 - 1회차 설정');
    } else {
        const msPerDay = 1000 * 60 * 60 * 24;
        const diffDays = Math.floor((thisSunday.getTime() - startDate.getTime()) / msPerDay);
        const weeksFromStart = Math.floor(diffDays / 7);
        let sessionNumber = weeksFromStart + 1; // 1회차부터 시작

        // 범위 보정
        if (sessionNumber < 1) sessionNumber = 1;
        if (sessionNumber > 12) sessionNumber = 12;

        defaultSession = sessionNumber;
        console.log(`이번 주 일요일 기준 회차 설정: ${defaultSession}회차 (일자: ${thisSunday.toLocaleDateString('ko-KR')})`);
    }
    
    console.log('설정할 기본 회차:', defaultSession);
    
    // 드롭다운에서 해당 회차 선택
    sessionSelect.value = defaultSession;
    currentSession = defaultSession;
    
    console.log('드롭다운 값 설정 완료:', sessionSelect.value);
    console.log('currentSession 변수 설정 완료:', currentSession);
    console.log('=== 회차 기본값 설정 완료 ===');
    
    // UI 업데이트
    renderMemberList();
    updateSummary();
}

function saveAndSync() {
    const saveSyncBtn = document.getElementById('saveSyncBtn');
    
    // 버튼 상태를 저장 중으로 변경
    saveSyncBtn.textContent = '저장 중...';
    saveSyncBtn.classList.add('saving');
    saveSyncBtn.disabled = true;
    
    // 저장 작업
    const saveSuccess = attendanceManager.saveData();
    
    if (saveSuccess) {
        // 저장 성공 시 동기화 시작
        saveSyncBtn.textContent = '동기화 중...';
        
        setTimeout(async () => {
            // Supabase에서 최신 데이터 로드
            if (attendanceManager.isOnline && attendanceManager.supabase) {
                await attendanceManager.loadFromCloud();
            }
            
            renderMemberList();
            updateSummary();
            
            // 성공 상태 표시
            const statusText = (attendanceManager.isOnline && attendanceManager.supabase) ? 
                '저장 및 동기화 완료!' : '로컬 저장 완료 (오프라인)';
            saveSyncBtn.textContent = statusText;
            saveSyncBtn.classList.remove('saving');
            saveSyncBtn.classList.add('success');
            
            // 동기화 시간 업데이트
            if (attendanceManager.isOnline && attendanceManager.supabase) {
                attendanceManager.updateSyncTime();
            }
            
            // 2초 후 원래 상태로 복원
            setTimeout(() => {
                saveSyncBtn.textContent = '저장 및 동기화';
                saveSyncBtn.classList.remove('success');
                saveSyncBtn.disabled = false;
            }, 2000);
        }, 800);
    } else {
        // 저장 실패 시
        saveSyncBtn.textContent = '저장 실패';
        saveSyncBtn.classList.remove('saving');
        saveSyncBtn.classList.add('error');
        
        setTimeout(() => {
            saveSyncBtn.textContent = '저장 및 동기화';
            saveSyncBtn.classList.remove('error');
            saveSyncBtn.disabled = false;
        }, 2000);
    }
}

function startRealTimeSync() {
    // 다른 탭에서의 변경사항 감지
    changeChannel = attendanceManager.listenForChanges((data) => {
        if (data.session === currentSession) {
            // 현재 세션의 변경사항이면 UI 업데이트
            const memberElement = document.querySelector(`[data-member-no="${data.memberNo}"]`);
            if (memberElement) {
                updateMemberButtons(memberElement, data.status);
                updateSummary(); // 이 함수가 악기별 집계도 함께 업데이트함
            }
        }
    });

    // BroadcastChannel을 통한 동기화 알림
    if (typeof BroadcastChannel !== 'undefined') {
        const syncChannel = new BroadcastChannel('attendance_sync');
        syncChannel.onmessage = (event) => {
            if (event.data.type === 'data_updated') {
                console.log('다른 탭에서 데이터 업데이트 알림');
                attendanceManager.checkForUpdates();
            }
        };
    }

    // 페이지 가시성 변경 시 동기화
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            // 간단한 동기화만 수행 (버튼 상태 변경 없이)
            attendanceManager.data = attendanceManager.loadData();
            renderMemberList();
            updateSummary();
        }
    });
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', function() {
    if (changeChannel) {
        changeChannel.close();
    }
});

// 오프라인/온라인 상태 감지
window.addEventListener('online', function() {
    console.log('온라인 상태로 복구됨');
    attendanceManager.isOnline = true;
    attendanceManager.updateSyncStatus('online', '온라인 상태');
    
    // Supabase에서 최신 데이터 동기화
    if (attendanceManager.supabase) {
        attendanceManager.loadFromCloud();
        loadMembersFromSupabase().then((loaded) => {
            if (loaded) {
                ensureDefaultMembers();
                renderMemberList();
                updateSummary();
            }
        });
    }
});

window.addEventListener('offline', function() {
    console.log('오프라인 상태');
    attendanceManager.isOnline = false;
    attendanceManager.updateSyncStatus('offline', '오프라인 상태');
});

// PWA 지원을 위한 서비스 워커 등록 (완전 비활성화)
// GitHub Pages에서 ServiceWorker 파일 접근 문제로 인해 비활성화
console.log('ServiceWorker 등록이 비활성화되어 있습니다. (GitHub Pages 호환성 문제)');


// ==================== 회원 관리 기능 ====================

// 회원 관리 이벤트 리스너 설정
function setupMemberManagementEvents() {
    // 회원 관리 버튼
    const memberManageBtn = document.getElementById('memberManageBtn');
    if (memberManageBtn) {
        memberManageBtn.addEventListener('click', openMemberManageModal);
    }

    // 악보 관리 버튼
    const sheetMusicManageBtn = document.getElementById('sheetMusicManageBtn');
    if (sheetMusicManageBtn) {
        sheetMusicManageBtn.addEventListener('click', openPasswordModal);
    }

    // 모달 닫기 버튼들
    const closeModal = document.getElementById('closeModal');
    const closeFormModal = document.getElementById('closeFormModal');
    const cancelMemberBtn = document.getElementById('cancelMemberBtn');
    
    // 악보관리 모달 닫기 버튼들
    const closeSheetMusicModal = document.getElementById('closeSheetMusicModal');
    const closeSheetMusicFormModal = document.getElementById('closeSheetMusicFormModal');
    const cancelSheetMusicBtn = document.getElementById('cancelSheetMusicBtn');
    
    // 비밀번호 모달 관련 요소들
    const closePasswordModalBtn = document.getElementById('closePasswordModal');
    const confirmPasswordBtn = document.getElementById('confirmPasswordBtn');
    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    const passwordInput = document.getElementById('passwordInput');

    if (closeModal) {
        closeModal.addEventListener('click', closeMemberManageModal);
    }
    if (closeFormModal) {
        closeFormModal.addEventListener('click', closeMemberFormModal);
    }
    if (cancelMemberBtn) {
        cancelMemberBtn.addEventListener('click', closeMemberFormModal);
    }
    
    // 악보관리 모달 닫기 이벤트 리스너
    if (closeSheetMusicModal) {
        closeSheetMusicModal.addEventListener('click', closeSheetMusicManageModal);
    }
    if (closeSheetMusicFormModal) {
        closeSheetMusicFormModal.addEventListener('click', closeSheetMusicFormModal);
    }
    if (cancelSheetMusicBtn) {
        cancelSheetMusicBtn.addEventListener('click', function() {
            console.log('취소 버튼 클릭됨');
            // 폼 데이터 초기화
            const form = document.getElementById('sheetMusicForm');
            if (form) {
                form.reset();
                delete form.dataset.sheetId;
            }
            // 임시 파일들 초기화
            window.tempFiles = [];
            // 파일 미리보기 초기화
            renderFilePreview([]);
            closeSheetMusicFormModal();
        });
    }
    
    // 비밀번호 모달 이벤트 리스너
    if (closePasswordModalBtn) {
        closePasswordModalBtn.addEventListener('click', closePasswordModal);
    }
    if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', closePasswordModal);
    }
    if (confirmPasswordBtn) {
        confirmPasswordBtn.addEventListener('click', handlePasswordConfirm);
    }
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handlePasswordConfirm();
            }
        });
    }

    // 회원 추가 버튼
    const addMemberBtn = document.getElementById('addMemberBtn');
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', openAddMemberForm);
    }

    // 회원 폼 제출
    const memberForm = document.getElementById('memberForm');
    if (memberForm) {
        memberForm.addEventListener('submit', handleMemberFormSubmit);
    }
    
    // 악보 추가 버튼
    const addSheetMusicBtn = document.getElementById('addSheetMusicBtn');
    if (addSheetMusicBtn) {
        addSheetMusicBtn.addEventListener('click', () => openSheetMusicForm());
    }
    
    // 악보 폼 제출
    const sheetMusicForm = document.getElementById('sheetMusicForm');
    if (sheetMusicForm) {
        sheetMusicForm.addEventListener('submit', handleSheetMusicFormSubmit);
    }
    
    // 악보 검색
    const sheetMusicSearch = document.getElementById('sheetMusicSearch');
    if (sheetMusicSearch) {
        sheetMusicSearch.addEventListener('input', handleSheetMusicSearch);
    }
    
    // 파일 업로드
    const sheetMusicFiles = document.getElementById('sheetMusicFiles');
    if (sheetMusicFiles) {
        sheetMusicFiles.addEventListener('change', handleFileUpload);
    }
    
    // 파일 모달 닫기
    const closeFileModalBtn = document.getElementById('closeFileModal');
    if (closeFileModalBtn) {
        closeFileModalBtn.addEventListener('click', closeFileModal);
    }
    
    // 악보 상세보기 모달 닫기
    const closeSheetDetailModalBtn = document.getElementById('closeSheetDetailModal');
    if (closeSheetDetailModalBtn) {
        closeSheetDetailModalBtn.addEventListener('click', closeSheetDetailModal);
    }

    // 모달 외부 클릭 시 닫기
    const memberManageModal = document.getElementById('memberManageModal');
    const memberFormModal = document.getElementById('memberFormModal');
    const sheetMusicManageModal = document.getElementById('sheetMusicManageModal');
    const sheetMusicFormModal = document.getElementById('sheetMusicFormModal');
    const fileModal = document.getElementById('fileModal');
    const sheetDetailModal = document.getElementById('sheetDetailModal');
    const passwordModal = document.getElementById('passwordModal');

    if (memberManageModal) {
        memberManageModal.addEventListener('click', function(e) {
            if (e.target === memberManageModal) {
                closeMemberManageModal();
            }
        });
    }

    if (memberFormModal) {
        memberFormModal.addEventListener('click', function(e) {
            if (e.target === memberFormModal) {
                closeMemberFormModal();
            }
        });
    }
    
    if (sheetMusicManageModal) {
        sheetMusicManageModal.addEventListener('click', function(e) {
            if (e.target === sheetMusicManageModal) {
                closeSheetMusicManageModal();
            }
        });
    }
    
    if (sheetMusicFormModal) {
        sheetMusicFormModal.addEventListener('click', function(e) {
            if (e.target === sheetMusicFormModal) {
                closeSheetMusicFormModal();
            }
        });
    }
    
    if (fileModal) {
        fileModal.addEventListener('click', function(e) {
            if (e.target === fileModal) {
                closeFileModal();
            }
        });
    }
    
    if (sheetDetailModal) {
        sheetDetailModal.addEventListener('click', function(e) {
            if (e.target === sheetDetailModal) {
                closeSheetDetailModal();
            }
        });
    }
    
    if (passwordModal) {
        passwordModal.addEventListener('click', function(e) {
            if (e.target === passwordModal) {
                closePasswordModal();
            }
        });
    }
}

// 회원 관리 모달 열기
function openMemberManageModal() {
    const modal = document.getElementById('memberManageModal');
    if (modal) {
        modal.style.display = 'block';
        renderMemberManageList();
    }
}

// 회원 관리 모달 닫기
function closeMemberManageModal() {
    const modal = document.getElementById('memberManageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 회원 폼 모달 열기
function openMemberFormModal() {
    const modal = document.getElementById('memberFormModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// 회원 폼 모달 닫기
function closeMemberFormModal() {
    const modal = document.getElementById('memberFormModal');
    if (modal) {
        modal.style.display = 'none';
        resetMemberForm();
    }
}

// 회원 추가 폼 열기
function openAddMemberForm() {
    editingMemberId = null;
    document.getElementById('memberFormTitle').textContent = '회원 추가';
    document.getElementById('saveMemberBtn').textContent = '저장';
    resetMemberForm();
    openMemberFormModal();
}

// 회원 수정 폼 열기
function openEditMemberForm(memberId) {
    console.log('=== 회원 수정 폼 열기 ===');
    console.log('memberId:', memberId);
    
    const member = members.find(m => m.no === memberId);
    console.log('찾은 회원:', member);
    
    if (!member) {
        console.error('회원을 찾을 수 없습니다:', memberId);
        return;
    }

    editingMemberId = memberId;
    console.log('editingMemberId 설정:', editingMemberId);
    
    document.getElementById('memberFormTitle').textContent = '회원 수정';
    document.getElementById('saveMemberBtn').textContent = '수정';
    
    // 폼에 기존 데이터 채우기
    document.getElementById('memberName').value = member.name;
    document.getElementById('memberInstrument').value = member.instrument;
    
    console.log('폼 데이터 설정 완료 - name:', member.name, 'instrument:', member.instrument);
    
    openMemberFormModal();
    console.log('=== 회원 수정 폼 열기 완료 ===');
}

// 회원 폼 리셋
function resetMemberForm() {
    document.getElementById('memberForm').reset();
    editingMemberId = null;
}

// 회원 관리 목록 렌더링
function renderMemberManageList() {
    const memberManageList = document.getElementById('memberManageList');
    if (!memberManageList) return;

    memberManageList.innerHTML = '';

    const sortedMembers = getSortedMembers();
    
    sortedMembers.forEach(member => {
        const memberElement = createMemberManageElement(member);
        memberManageList.appendChild(memberElement);
    });
}

// 회원 관리 아이템 요소 생성
function createMemberManageElement(member) {
    const div = document.createElement('div');
    div.className = 'member-manage-item';
    div.dataset.memberId = member.no;

    div.innerHTML = `
        <div class="member-info">
            <div class="member-name">${member.name}</div>
            <div class="member-instrument">${member.instrument}</div>
        </div>
        <div class="member-actions">
            <button class="edit-member-btn" onclick="openEditMemberForm(${member.no})">수정</button>
            <button class="delete-member-btn" onclick="deleteMember(${member.no})">삭제</button>
        </div>
    `;

    return div;
}

// 회원 폼 제출 처리
function handleMemberFormSubmit(e) {
    e.preventDefault();
    
    console.log('=== 폼 제출 처리 시작 ===');
    console.log('editingMemberId:', editingMemberId);
    
    const formData = new FormData(e.target);
    const name = formData.get('name').trim();
    const instrument = formData.get('instrument');
    
    console.log('폼 데이터 - name:', name, 'instrument:', instrument);

    if (!name || !instrument) {
        console.log('입력값 검증 실패');
        alert('이름과 악기를 모두 입력해주세요.');
        return;
    }

    if (editingMemberId) {
        // 회원 수정
        console.log('회원 수정 모드로 진행');
        updateMember(editingMemberId, name, instrument);
    } else {
        // 회원 추가
        console.log('회원 추가 모드로 진행');
        addMember(name, instrument);
    }

    closeMemberFormModal();
    console.log('=== 폼 제출 처리 끝 ===');
}

// 회원 추가
function addMember(name, instrument) {
    const newMember = {
        no: nextMemberId++,
        name: name,
        instrument: instrument
    };

    members.push(newMember);
    saveMembersToStorage();
    // Supabase에도 추가
    if (attendanceManager.isOnline && attendanceManager.supabase) {
        upsertMemberToSupabase(newMember);
    }
    renderMemberManageList();
    renderMemberList();
    updateSummary();
    updateInstrumentMemberCounts();
    
    console.log('회원 추가됨:', newMember);
}

// 회원 수정
function updateMember(memberId, name, instrument) {
    console.log('=== 회원 수정 시작 ===');
    console.log('memberId:', memberId);
    console.log('name:', name);
    console.log('instrument:', instrument);
    
    const memberIndex = members.findIndex(m => m.no === memberId);
    console.log('memberIndex:', memberIndex);
    
    if (memberIndex === -1) {
        console.error('회원을 찾을 수 없습니다:', memberId);
        return;
    }

    const oldMember = members[memberIndex];
    console.log('수정 전 회원:', oldMember);
    
    members[memberIndex] = {
        ...oldMember,
        name: name,
        instrument: instrument
    };
    
    console.log('수정 후 회원:', members[memberIndex]);

    // 로컬 스토리지 저장
    const saveResult = saveMembersToStorage();
    console.log('로컬 저장 결과:', saveResult);
    
    // Supabase에도 반영
    if (attendanceManager.isOnline && attendanceManager.supabase) {
        console.log('Supabase에 동기화 시작');
        upsertMemberToSupabase(members[memberIndex]);
    } else {
        console.log('Supabase 동기화 건너뜀 (오프라인 또는 연결 없음)');
    }
    
    // UI 업데이트
    renderMemberManageList();
    renderMemberList();
    updateSummary();
    updateInstrumentMemberCounts();
    
    console.log('회원 수정 완료:', members[memberIndex]);
    console.log('=== 회원 수정 끝 ===');
}

// 회원 삭제
function deleteMember(memberId) {
    if (!confirm('정말로 이 회원을 삭제하시겠습니까?')) {
        return;
    }

    const memberIndex = members.findIndex(m => m.no === memberId);
    if (memberIndex === -1) return;

    const deletedMember = members[memberIndex];
    members.splice(memberIndex, 1);

    // 해당 회원의 출석 기록도 삭제
    deleteMemberAttendanceRecords(memberId);

    saveMembersToStorage();
    // Supabase에서도 멤버 삭제 (attendance_records는 별도로 이미 삭제됨)
    if (attendanceManager.isOnline && attendanceManager.supabase) {
        removeMemberFromSupabase(memberId);
    }
    renderMemberManageList();
    renderMemberList();
    updateSummary();
    updateInstrumentMemberCounts();
    
    console.log('회원 삭제됨:', deletedMember);
}

// 회원의 출석 기록 삭제
function deleteMemberAttendanceRecords(memberId) {
    // 로컬 데이터에서 해당 회원의 출석 기록 삭제
    Object.keys(attendanceManager.data).forEach(session => {
        if (attendanceManager.data[session][memberId]) {
            delete attendanceManager.data[session][memberId];
        }
    });
    
    // 로컬스토리지에 저장
    attendanceManager.saveToLocal();
    
    // Supabase에서도 삭제 (온라인인 경우)
    if (attendanceManager.isOnline && attendanceManager.supabase) {
        deleteMemberFromSupabase(memberId);
    }
}

// Supabase에서 회원 삭제
async function deleteMemberFromSupabase(memberId) {
    try {
        const { error } = await attendanceManager.supabase
            .from('attendance_records')
            .delete()
            .eq('member_id', memberId);

        if (error) {
            console.error('Supabase에서 회원 출석 기록 삭제 실패:', error);
        } else {
            console.log('Supabase에서 회원 출석 기록 삭제 완료');
        }
    } catch (error) {
        console.error('Supabase 회원 삭제 오류:', error);
    }
}

// Supabase에 멤버 upsert
async function upsertMemberToSupabase(member) {
    try {
        console.log('Supabase 멤버 upsert 시작:', member);
        
        const { error } = await attendanceManager.supabase
            .from('members')
            .upsert(
                { no: member.no, name: member.name, instrument: member.instrument },
                { onConflict: 'no' }  // no 컬럼이 충돌 시 업데이트
            );
            
        if (error) {
            console.error('Supabase 멤버 upsert 실패:', error);
            return false;
        } else {
            console.log('Supabase 멤버 upsert 완료');
            
            // id 매핑 최신화
            try {
                const { data } = await attendanceManager.supabase
                    .from('members')
                    .select('id')
                    .eq('no', member.no)
                    .maybeSingle();
                if (data && data.id) {
                    memberNoToSupabaseId[member.no] = data.id;
                    console.log('ID 매핑 업데이트:', member.no, '->', data.id);
                }
            } catch (mappingError) {
                console.error('ID 매핑 업데이트 실패:', mappingError);
            }
            return true;
        }
    } catch (e) {
        console.error('Supabase 멤버 upsert 오류:', e);
        return false;
    }
}

// Supabase에서 멤버 삭제
async function removeMemberFromSupabase(memberId) {
    try {
        const { error } = await attendanceManager.supabase
            .from('members')
            .delete()
            .eq('no', memberId);
        if (error) {
            console.error('Supabase 멤버 삭제 실패:', error);
        } else {
            console.log('Supabase 멤버 삭제 완료');
        }
    } catch (e) {
        console.error('Supabase 멤버 삭제 오류:', e);
    }
}

// 주어진 memberNo가 Supabase members 테이블에 없으면 upsert
async function ensureMemberInSupabase(memberNo) {
    try {
        if (!attendanceManager.isOnline || !attendanceManager.supabase) return false;
        const member = members.find(m => m.no === parseInt(memberNo));
        if (!member) return false;
        const { data, error } = await attendanceManager.supabase
            .from('members')
            .select('id, no')
            .eq('no', member.no)
            .maybeSingle();
        if (error) {
            console.warn('Supabase 멤버 조회 경고:', error);
        }
        if (!data) {
            // 없으면 upsert
            await upsertMemberToSupabase(member);
            return true;
        }
        if (data.id) {
            memberNoToSupabaseId[member.no] = data.id;
        }
        return true;
    } catch (e) {
        console.error('ensureMemberInSupabase 오류:', e);
        return false;
    }
}

// 회원 데이터를 로컬스토리지에 저장
function saveMembersToStorage() {
    try {
        localStorage.setItem('chamber_members', JSON.stringify(members));
        console.log('회원 데이터 저장 완료:', members.length, '명');
        return true;
    } catch (error) {
        console.error('회원 데이터 저장 실패:', error);
        return false;
    }
}

// 로컬스토리지에서 회원 데이터 로드
function loadMembersFromStorage() {
    try {
        const saved = localStorage.getItem('chamber_members');
        if (saved) {
            const savedMembers = JSON.parse(saved);
            if (Array.isArray(savedMembers) && savedMembers.length > 0) {
                // 기존 members 배열을 저장된 데이터로 교체
                members.length = 0;
                members.push(...savedMembers);
                
                // 다음 회원 ID 업데이트
                const maxId = Math.max(...members.map(m => m.no));
                nextMemberId = maxId + 1;
                
                console.log('회원 데이터 로드 완료:', members.length, '명');
                return true;
            }
        }
    } catch (error) {
        console.error('회원 데이터 로드 실패:', error);
    }
    return false;
}

// Supabase에서 멤버 목록 로드 (가능하면 항상 최신 데이터 사용)
async function loadMembersFromSupabase() {
    try {
        if (!attendanceManager.isOnline || !attendanceManager.supabase) {
            return false;
        }
        const { data, error } = await attendanceManager.supabase
            .from('members')
            .select('id, no, name, instrument')
            .order('no', { ascending: true });

        if (error) {
            console.error('Supabase 멤버 로드 실패:', error);
            return false;
        }

        if (Array.isArray(data) && data.length > 0) {
            members.length = 0;
            data.forEach(row => {
                // 매핑 캐시 업데이트: no -> id
                if (row.no && row.id) {
                    memberNoToSupabaseId[row.no] = row.id;
                }
                members.push({ no: row.no, name: row.name, instrument: row.instrument });
            });
            const maxId = Math.max(...members.map(m => m.no));
            nextMemberId = isFinite(maxId) ? maxId + 1 : nextMemberId;
            saveMembersToStorage();
            console.log('Supabase에서 멤버 로드 완료:', members.length, '명');
            return true;
        }
        return false;
    } catch (e) {
        console.error('Supabase 멤버 로드 오류:', e);
        return false;
    }
}

// ===== 악보 관리 기능 =====

// 파일 관련 유틸리티 함수들
function getFileIcon(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
        case 'pdf':
            return { icon: '📄', class: 'file-icon-pdf' };
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
            return { icon: '🖼️', class: 'file-icon-image' };
        case 'mp3':
        case 'wav':
            return { icon: '🎵', class: 'file-icon-audio' };
        case 'mid':
        case 'midi':
            return { icon: '🎼', class: 'file-icon-midi' };
        default:
            return { icon: '📎', class: 'file-icon-other' };
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateFileId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 한글 파일명을 안전한 형태로 변환
function sanitizeFileName(fileName) {
    // 파일 확장자 분리
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
    
    // 한글과 특수문자를 안전한 형태로 변환
    const sanitizedName = name
        .replace(/[가-힣]/g, (char) => {
            // 한글을 유니코드로 변환
            return 'u' + char.charCodeAt(0).toString(16);
        })
        .replace(/[^a-zA-Z0-9._-]/g, '_') // 영문, 숫자, 점, 언더스코어, 하이픈만 허용
        .substring(0, 50); // 파일명 길이 제한
    
    return sanitizedName + extension;
}

// 파일을 Base64로 변환
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Base64를 Blob으로 변환
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

// 악보 데이터 로컬 저장
function saveSheetMusicToStorage() {
    try {
        localStorage.setItem('sheetMusicList', JSON.stringify(sheetMusicList));
        console.log('악보 데이터 로컬 저장 완료:', sheetMusicList.length, '개');
        return true;
    } catch (error) {
        console.error('악보 데이터 로컬 저장 실패:', error);
        return false;
    }
}

// Supabase에 악보 데이터 저장
async function saveSheetMusicToSupabase() {
    if (!attendanceManager.isOnline || !attendanceManager.supabase) {
        console.log('Supabase 연결 없음 - 악보 데이터 클라우드 저장 건너뜀');
        return false;
    }

    try {
        console.log('Supabase에 악보 데이터 저장 시작...');
        
        for (const sheet of sheetMusicList) {
            // 임시 ID인 경우 (Date.now()로 생성된 경우) ID를 제외하고 저장
            const isTempId = sheet.id > 1000000000000; // Date.now() 값은 13자리 이상
            
            const sheetData = {
                title: sheet.title,
                composer: sheet.composer,
                arranger: sheet.arranger,
                genre: sheet.genre,
                difficulty: sheet.difficulty,
                notes: sheet.notes,
                files: sheet.files || []
            };
            
            if (!isTempId) {
                sheetData.id = sheet.id;
            }
            
            const { data, error } = await attendanceManager.supabase
                .from('sheet_music')
                .upsert(sheetData, { onConflict: 'id' })
                .select();

            if (error) {
                console.error('악보 Supabase 저장 실패:', error);
            } else {
                console.log('악보 Supabase 저장 완료:', sheet.title);
                
                // 새로 생성된 경우 ID 업데이트
                if (isTempId && data && data.length > 0) {
                    const newId = data[0].id;
                    const index = sheetMusicList.findIndex(s => s.id === sheet.id);
                    if (index !== -1) {
                        sheetMusicList[index].id = newId;
                        console.log('악보 ID 업데이트:', sheet.title, '->', newId);
                    }
                }
            }
        }
        
        console.log('Supabase에 악보 데이터 저장 완료');
        return true;
    } catch (error) {
        console.error('Supabase 악보 저장 오류:', error);
        return false;
    }
}

// Supabase에서 악보 데이터 로드
async function loadSheetMusicFromSupabase() {
    if (!attendanceManager.isOnline || !attendanceManager.supabase) {
        console.log('Supabase 연결 없음 - 악보 데이터 클라우드 로드 건너뜀');
        return false;
    }

    try {
        console.log('Supabase에서 악보 데이터 로드 시작...');
        
        const { data, error } = await attendanceManager.supabase
            .from('sheet_music')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Supabase 악보 로드 실패:', error);
            return false;
        }

        if (data && data.length > 0) {
            sheetMusicList = data.map(row => ({
                id: row.id,
                title: row.title,
                composer: row.composer,
                arranger: row.arranger,
                genre: row.genre,
                difficulty: row.difficulty,
                notes: row.notes,
                files: row.files || []
            }));
            
            saveSheetMusicToStorage();
            console.log('Supabase에서 악보 로드 완료:', sheetMusicList.length, '개');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Supabase 악보 로드 오류:', error);
        return false;
    }
}

// 악보 데이터 로컬 로드
function loadSheetMusicFromStorage() {
    try {
        const stored = localStorage.getItem('sheetMusicList');
        if (stored) {
            sheetMusicList = JSON.parse(stored);
            console.log('악보 데이터 로컬 로드 완료:', sheetMusicList.length, '개');
            return true;
        }
    } catch (error) {
        console.error('악보 데이터 로컬 로드 실패:', error);
    }
    return false;
}

// 악보 목록 렌더링
function renderSheetMusicList(searchTerm = '') {
    const container = document.getElementById('sheetMusicList');
    if (!container) return;

    let filteredList = sheetMusicList;
    if (searchTerm) {
        filteredList = sheetMusicList.filter(sheet => 
            sheet.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sheet.composer.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sheet.arranger.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sheet.genre.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    if (filteredList.length === 0) {
        container.innerHTML = '<div class="no-data">등록된 악보가 없습니다.</div>';
        return;
    }

    container.innerHTML = filteredList.map(sheet => `
        <div class="sheet-music-item" data-id="${sheet.id}">
            <div class="sheet-music-header">
                <h3 class="sheet-music-title" onclick="openSheetDetailModal(${sheet.id})" style="cursor: pointer;">${sheet.title}</h3>
                <div class="sheet-music-actions">
                    <button class="edit-sheet-music-btn" onclick="openEditSheetMusicForm(${sheet.id})">수정</button>
                    <button class="delete-sheet-music-btn" onclick="deleteSheetMusic(${sheet.id})">삭제</button>
                </div>
            </div>
            <div class="sheet-music-details">
                <div class="sheet-music-detail">
                    <strong>작곡가:</strong> ${sheet.composer || '-'}
                </div>
                <div class="sheet-music-detail">
                    <strong>편곡가:</strong> ${sheet.arranger || '-'}
                </div>
                <div class="sheet-music-detail">
                    <strong>장르:</strong> ${sheet.genre || '-'}
                </div>
                <div class="sheet-music-detail">
                    <strong>난이도:</strong> ${sheet.difficulty || '-'}
                </div>
            </div>
            ${sheet.notes ? `<div class="sheet-music-notes">${sheet.notes}</div>` : ''}
            ${sheet.files && sheet.files.length > 0 ? `
                <div class="sheet-music-files">
                    <div class="file-tag" data-sheet-id="${sheet.id}" style="cursor: pointer;">
                        <span class="file-tag-icon">📎</span>
                        첨부파일
                        <span class="file-tag-count">${sheet.files.length}</span>
                    </div>
                </div>
            ` : ''}
        </div>
    `).join('');
    
    // 첨부파일 클릭 이벤트 리스너 추가 (모바일 호환성을 위해)
    container.querySelectorAll('.file-tag').forEach(tag => {
        // 기존 이벤트 리스너 제거 (중복 방지)
        tag.removeEventListener('click', handleFileTagClick);
        tag.removeEventListener('touchstart', handleFileTagTouch);
        
        // 클릭 이벤트
        tag.addEventListener('click', handleFileTagClick);
        
        // 터치 이벤트 (모바일용)
        tag.addEventListener('touchstart', handleFileTagTouch, { passive: false });
    });
    
    // 파일 태그 클릭 핸들러
    function handleFileTagClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const sheetId = parseInt(this.dataset.sheetId);
        console.log('파일 태그 클릭됨:', sheetId);
        openFileModal(sheetId);
    }
    
    // 파일 태그 터치 핸들러
    function handleFileTagTouch(e) {
        e.preventDefault();
        e.stopPropagation();
        const sheetId = parseInt(this.dataset.sheetId);
        console.log('파일 태그 터치됨:', sheetId);
        openFileModal(sheetId);
    }
}

// 악보 추가/수정 폼 열기
function openSheetMusicForm(sheetId = null) {
    const modal = document.getElementById('sheetMusicFormModal');
    const title = document.getElementById('sheetMusicFormTitle');
    const form = document.getElementById('sheetMusicForm');
    
    if (sheetId) {
        // 수정 모드
        const sheet = sheetMusicList.find(s => s.id === sheetId);
        if (sheet) {
            title.textContent = '악보 수정';
            document.getElementById('sheetMusicTitle').value = sheet.title;
            document.getElementById('sheetMusicComposer').value = sheet.composer || '';
            document.getElementById('sheetMusicArranger').value = sheet.arranger || '';
            document.getElementById('sheetMusicGenre').value = sheet.genre || '';
            document.getElementById('sheetMusicDifficulty').value = sheet.difficulty || '';
            document.getElementById('sheetMusicNotes').value = sheet.notes || '';
            form.dataset.sheetId = sheetId;
            
            // 기존 파일들 표시
            renderFilePreview(sheet.files || []);
        }
    } else {
        // 추가 모드
        title.textContent = '악보 추가';
        form.reset();
        delete form.dataset.sheetId;
        renderFilePreview([]);
    }
    
    modal.style.display = 'block';
}

// 악보 추가/수정 폼 열기 (별칭)
function openEditSheetMusicForm(sheetId) {
    openSheetMusicForm(sheetId);
}

// 악보 추가/수정 처리
async function handleSheetMusicFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const sheetId = form.dataset.sheetId;
    
    const sheetData = {
        title: formData.get('title'),
        composer: formData.get('composer'),
        arranger: formData.get('arranger'),
        genre: formData.get('genre'),
        difficulty: formData.get('difficulty'),
        notes: formData.get('notes'),
        files: getCurrentFormFiles() // 현재 폼의 파일들 포함
    };
    
    if (sheetId) {
        // 수정
        const index = sheetMusicList.findIndex(s => s.id === parseInt(sheetId));
        if (index !== -1) {
            sheetMusicList[index] = { ...sheetMusicList[index], ...sheetData };
            console.log('악보 수정 완료:', sheetData.title);
        }
    } else {
        // 추가 - 임시 ID 사용 (Supabase에서 실제 ID 할당)
        const tempId = Date.now(); // 임시 ID
        sheetMusicList.push({ id: tempId, ...sheetData });
        console.log('악보 추가 완료:', sheetData.title);
    }
    
    // 임시 파일들 초기화
    window.tempFiles = [];
    
    // 로컬 저장
    saveSheetMusicToStorage();
    
    // Supabase 동기화
    if (attendanceManager.isOnline && attendanceManager.supabase) {
        await saveSheetMusicToSupabase();
    }
    
    renderSheetMusicList();
    closeSheetMusicFormModal();
}

// 악보 삭제
async function deleteSheetMusic(sheetId) {
    if (confirm('정말로 이 악보를 삭제하시겠습니까?')) {
        const index = sheetMusicList.findIndex(s => s.id === sheetId);
        if (index !== -1) {
            const deletedSheet = sheetMusicList.splice(index, 1)[0];
            console.log('악보 삭제 완료:', deletedSheet.title);
            
            // 첨부파일들도 함께 삭제
            if (deletedSheet.files && deletedSheet.files.length > 0) {
                try {
                    const filePaths = deletedSheet.files.map(file => file.path).filter(path => path);
                    if (filePaths.length > 0) {
                        const { error } = await attendanceManager.supabase.storage
                            .from('sheet-music-files')
                            .remove(filePaths);
                        
                        if (error) {
                            console.error('Supabase Storage 파일 삭제 실패:', error);
                        } else {
                            console.log('Supabase Storage에서 파일들 삭제 완료:', filePaths.length, '개');
                        }
                    }
                } catch (error) {
                    console.error('파일 삭제 오류:', error);
                }
            }
            
            // 로컬 저장
            saveSheetMusicToStorage();
            
            // Supabase에서 삭제
            if (attendanceManager.isOnline && attendanceManager.supabase) {
                try {
                    const { error } = await attendanceManager.supabase
                        .from('sheet_music')
                        .delete()
                        .eq('id', sheetId);
                    
                    if (error) {
                        console.error('Supabase 악보 삭제 실패:', error);
                    } else {
                        console.log('Supabase 악보 삭제 완료:', deletedSheet.title);
                    }
                } catch (error) {
                    console.error('Supabase 악보 삭제 오류:', error);
                }
            }
            
            renderSheetMusicList();
        }
    }
}

// 악보 검색
function handleSheetMusicSearch(e) {
    const searchTerm = e.target.value;
    renderSheetMusicList(searchTerm);
}

// 악보관리 모달 열기
async function openSheetMusicManageModal() {
    const modal = document.getElementById('sheetMusicManageModal');
    modal.style.display = 'block';
    
    // Supabase에서 최신 악보 데이터 로드
    if (attendanceManager.isOnline && attendanceManager.supabase) {
        await loadSheetMusicFromSupabase();
    }
    
    renderSheetMusicList();
}

// 악보관리 모달 닫기
function closeSheetMusicManageModal() {
    const modal = document.getElementById('sheetMusicManageModal');
    modal.style.display = 'none';
}

// 악보 폼 모달 닫기
function closeSheetMusicFormModal() {
    const modal = document.getElementById('sheetMusicFormModal');
    modal.style.display = 'none';
}

// 파일 미리보기 렌더링
function renderFilePreview(files) {
    const container = document.getElementById('filePreview');
    if (!container) return;
    
    if (files.length === 0) {
        container.innerHTML = '<div style="color: #6c757d; font-style: italic;">첨부된 파일이 없습니다.</div>';
        return;
    }
    
    container.innerHTML = files.map(file => {
        const fileIcon = getFileIcon(file.name);
        return `
            <div class="file-preview-item" data-file-id="${file.id}">
                <div class="file-info">
                    <div class="file-icon ${fileIcon.class}">${fileIcon.icon}</div>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button class="file-remove" onclick="removeFileFromPreview('${file.id}')">삭제</button>
            </div>
        `;
    }).join('');
}

// 파일 업로드 처리
async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    const currentFiles = getCurrentFormFiles();
    
    for (const file of files) {
        // 파일 크기 제한 (50MB)
        if (file.size > 50 * 1024 * 1024) {
            alert(`파일 "${file.name}"이 너무 큽니다. (최대 50MB)`);
            continue;
        }
        
        // 중복 파일 체크
        if (currentFiles.some(f => f.name === file.name)) {
            alert(`파일 "${file.name}"이 이미 첨부되어 있습니다.`);
            continue;
        }
        
        try {
            const fileId = generateFileId();
            const form = document.getElementById('sheetMusicForm');
            const sheetId = form.dataset.sheetId || 'temp';
            
            // 한글 파일명을 안전한 형태로 변환
            const safeFileName = sanitizeFileName(file.name);
            const filePath = `${sheetId}/${fileId}_${safeFileName}`;
            
            let fileData = {
                id: fileId,
                name: file.name, // 원본 파일명 유지
                safeName: safeFileName, // 안전한 파일명 저장
                size: file.size,
                type: file.type,
                uploaded_at: new Date().toISOString()
            };
            
            // Supabase Storage에 파일 업로드 (온라인인 경우)
            if (attendanceManager.isOnline && attendanceManager.supabase) {
                const { data, error } = await attendanceManager.supabase.storage
                    .from('sheet-music-files')
                    .upload(filePath, file);
                
                if (error) {
                    console.error('Supabase Storage 업로드 오류:', error);
                    alert(`파일 "${file.name}" 업로드 실패: ${error.message}`);
                    continue;
                }
                
                fileData.path = data.path;
                console.log('파일 업로드 완료:', file.name, '->', data.path);
            } else {
                // 오프라인 모드: Base64로 저장
                console.log('오프라인 모드: 파일을 Base64로 저장');
                const base64 = await fileToBase64(file);
                fileData.data = base64;
            }
            
            currentFiles.push(fileData);
            
        } catch (error) {
            console.error('파일 업로드 오류:', error);
            alert(`파일 "${file.name}" 업로드 중 오류가 발생했습니다.`);
        }
    }
    
    renderFilePreview(currentFiles);
    
    // 파일 입력 초기화
    event.target.value = '';
}

// 현재 폼의 파일 목록 가져오기
function getCurrentFormFiles() {
    const form = document.getElementById('sheetMusicForm');
    const sheetId = form.dataset.sheetId;
    
    if (sheetId) {
        // 수정 모드 - 기존 파일들
        const sheet = sheetMusicList.find(s => s.id === parseInt(sheetId));
        return sheet ? (sheet.files || []) : [];
    } else {
        // 추가 모드 - 임시 파일들
        if (!window.tempFiles) {
            window.tempFiles = [];
        }
        return window.tempFiles;
    }
}

// 현재 폼의 파일 목록 설정
function setCurrentFormFiles(files) {
    const form = document.getElementById('sheetMusicForm');
    const sheetId = form.dataset.sheetId;
    
    if (sheetId) {
        // 수정 모드 - 기존 파일들 업데이트
        const sheet = sheetMusicList.find(s => s.id === parseInt(sheetId));
        if (sheet) {
            sheet.files = files;
        }
    } else {
        // 추가 모드 - 임시 파일들
        window.tempFiles = files;
    }
}

// 파일 미리보기에서 파일 제거
async function removeFileFromPreview(fileId) {
    const currentFiles = getCurrentFormFiles();
    const fileToRemove = currentFiles.find(f => f.id === fileId);
    
    if (fileToRemove && fileToRemove.path) {
        try {
            // Supabase Storage에서 파일 삭제
            const { error } = await attendanceManager.supabase.storage
                .from('sheet-music-files')
                .remove([fileToRemove.path]);
            
            if (error) {
                console.error('Supabase Storage 삭제 오류:', error);
                alert(`파일 삭제 실패: ${error.message}`);
                return;
            }
            
            console.log('Supabase Storage에서 파일 삭제 완료:', fileToRemove.name);
            
        } catch (error) {
            console.error('파일 삭제 오류:', error);
            alert('파일 삭제 중 오류가 발생했습니다.');
            return;
        }
    }
    
    const updatedFiles = currentFiles.filter(f => f.id !== fileId);
    setCurrentFormFiles(updatedFiles);
    renderFilePreview(updatedFiles);
}

// 파일 모달 열기
function openFileModal(sheetId) {
    console.log('openFileModal 호출됨, sheetId:', sheetId);
    const modal = document.getElementById('fileModal');
    const title = document.getElementById('fileModalTitle');
    const fileList = document.getElementById('fileList');
    
    console.log('모달 요소들:', { modal, title, fileList });
    
    const sheet = sheetMusicList.find(s => s.id === sheetId);
    console.log('찾은 악보:', sheet);
    
    if (sheet && sheet.files && sheet.files.length > 0) {
        console.log('첨부파일 개수:', sheet.files.length);
        title.textContent = `${sheet.title} - 첨부파일`;
        
        fileList.innerHTML = sheet.files.map(file => {
            const fileIcon = getFileIcon(file.name);
            return `
                <div class="file-item" data-file-id="${file.id}">
                    <div class="file-item-icon ${fileIcon.class}">${fileIcon.icon}</div>
                    <div class="file-item-name">${file.name}</div>
                    <div class="file-item-size">${formatFileSize(file.size)}</div>
                    <div class="file-item-actions">
                        <button class="file-preview-btn" data-file-id="${file.id}" data-file-name="${file.name}" data-file-type="${file.type}">미리보기</button>
                        <button class="file-download-btn" data-file-id="${file.id}" data-file-name="${file.name}" data-file-type="${file.type}">다운로드</button>
                        <button class="file-delete-btn" data-sheet-id="${sheetId}" data-file-id="${file.id}">삭제</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 이벤트 리스너 추가 (모바일 호환성을 위해)
        fileList.querySelectorAll('.file-preview-btn').forEach(btn => {
            // 기존 이벤트 리스너 제거
            btn.removeEventListener('click', handlePreviewClick);
            btn.removeEventListener('touchstart', handlePreviewTouch);
            
            // 클릭 이벤트
            btn.addEventListener('click', handlePreviewClick);
            
            // 터치 이벤트 (모바일용)
            btn.addEventListener('touchstart', handlePreviewTouch, { passive: false });
        });
        
        fileList.querySelectorAll('.file-download-btn').forEach(btn => {
            // 기존 이벤트 리스너 제거
            btn.removeEventListener('click', handleDownloadClick);
            btn.removeEventListener('touchstart', handleDownloadTouch);
            
            // 클릭 이벤트
            btn.addEventListener('click', handleDownloadClick);
            
            // 터치 이벤트 (모바일용)
            btn.addEventListener('touchstart', handleDownloadTouch, { passive: false });
        });
        
        fileList.querySelectorAll('.file-delete-btn').forEach(btn => {
            // 기존 이벤트 리스너 제거
            btn.removeEventListener('click', handleDeleteClick);
            btn.removeEventListener('touchstart', handleDeleteTouch);
            
            // 클릭 이벤트
            btn.addEventListener('click', handleDeleteClick);
            
            // 터치 이벤트 (모바일용)
            btn.addEventListener('touchstart', handleDeleteTouch, { passive: false });
        });
        
        // 미리보기 버튼 클릭 핸들러
        function handlePreviewClick(e) {
            e.preventDefault();
            e.stopPropagation();
            const fileId = this.dataset.fileId;
            const fileName = this.dataset.fileName;
            const fileType = this.dataset.fileType;
            console.log('미리보기 버튼 클릭됨:', fileName);
            previewFile(fileId, fileName, fileType);
        }
        
        // 미리보기 버튼 터치 핸들러
        function handlePreviewTouch(e) {
            e.preventDefault();
            e.stopPropagation();
            const fileId = this.dataset.fileId;
            const fileName = this.dataset.fileName;
            const fileType = this.dataset.fileType;
            console.log('미리보기 버튼 터치됨:', fileName);
            previewFile(fileId, fileName, fileType);
        }
        
        // 다운로드 버튼 클릭 핸들러
        function handleDownloadClick(e) {
            e.preventDefault();
            e.stopPropagation();
            const fileId = this.dataset.fileId;
            const fileName = this.dataset.fileName;
            const fileType = this.dataset.fileType;
            console.log('다운로드 버튼 클릭됨:', fileName);
            downloadFile(fileId, fileName, fileType);
        }
        
        // 다운로드 버튼 터치 핸들러
        function handleDownloadTouch(e) {
            e.preventDefault();
            e.stopPropagation();
            const fileId = this.dataset.fileId;
            const fileName = this.dataset.fileName;
            const fileType = this.dataset.fileType;
            console.log('다운로드 버튼 터치됨:', fileName);
            downloadFile(fileId, fileName, fileType);
        }
        
        // 삭제 버튼 클릭 핸들러
        function handleDeleteClick(e) {
            e.preventDefault();
            e.stopPropagation();
            const sheetId = this.dataset.sheetId;
            const fileId = this.dataset.fileId;
            console.log('삭제 버튼 클릭됨:', fileId);
            deleteFileFromSheet(parseInt(sheetId), fileId);
        }
        
        // 삭제 버튼 터치 핸들러
        function handleDeleteTouch(e) {
            e.preventDefault();
            e.stopPropagation();
            const sheetId = this.dataset.sheetId;
            const fileId = this.dataset.fileId;
            console.log('삭제 버튼 터치됨:', fileId);
            deleteFileFromSheet(parseInt(sheetId), fileId);
        }
        
        modal.style.display = 'block';
        console.log('파일 모달이 열렸습니다');
    } else {
        console.log('첨부파일이 없거나 악보를 찾을 수 없습니다');
        alert('첨부파일이 없습니다.');
    }
}

// 파일 모달 닫기
function closeFileModal() {
    const modal = document.getElementById('fileModal');
    modal.style.display = 'none';
}

// 파일 다운로드
async function downloadFile(fileId, fileName, mimeType) {
    let file = null;
    
    // 현재 폼의 파일에서 찾기
    const currentFiles = getCurrentFormFiles();
    file = currentFiles.find(f => f.id === fileId);
    
    // 악보의 파일에서 찾기
    if (!file) {
        for (const sheet of sheetMusicList) {
            if (sheet.files) {
                file = sheet.files.find(f => f.id === fileId);
                if (file) break;
            }
        }
    }
    
    if (!file) {
        console.error('파일을 찾을 수 없습니다:', fileId);
        return;
    }
    
    try {
        let blob = null;
        
        // Supabase Storage에서 파일 다운로드 (path가 있는 경우)
        if (file.path && attendanceManager.isOnline && attendanceManager.supabase) {
            const { data, error } = await attendanceManager.supabase.storage
                .from('sheet-music-files')
                .download(file.path);
            
            if (error) {
                console.error('Supabase Storage 다운로드 오류:', error);
                alert(`파일 다운로드 실패: ${error.message}`);
                return;
            }
            
            blob = data;
        } else if (file.data) {
            // Base64 데이터가 있는 경우 (오프라인 모드)
            blob = base64ToBlob(file.data, file.type);
        } else {
            alert('파일을 다운로드할 수 없습니다. 파일 정보가 없습니다.');
            return;
        }
        
        // 모바일에서 다운로드 처리
        if (isMobile()) {
            // 모바일에서는 새 탭에서 열기
            const url = URL.createObjectURL(blob);
            const newWindow = window.open(url, '_blank');
            if (!newWindow) {
                // 팝업이 차단된 경우 사용자에게 알림
                alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
                // 대안으로 직접 링크 제공
                const link = document.createElement('a');
                link.href = url;
                link.download = file.name;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            // URL은 나중에 정리
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
            // 데스크톱에서는 일반 다운로드
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        console.log('파일 다운로드 완료:', file.name);
        
    } catch (error) {
        console.error('파일 다운로드 오류:', error);
        alert('파일 다운로드 중 오류가 발생했습니다.');
    }
}

// 모바일 디바이스 감지
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
}

// 파일 미리보기
async function previewFile(fileId, fileName, mimeType) {
    let file = null;
    
    // 현재 폼의 파일에서 찾기
    const currentFiles = getCurrentFormFiles();
    file = currentFiles.find(f => f.id === fileId);
    
    // 악보의 파일에서 찾기
    if (!file) {
        for (const sheet of sheetMusicList) {
            if (sheet.files) {
                file = sheet.files.find(f => f.id === fileId);
                if (file) break;
            }
        }
    }
    
    if (!file) {
        console.error('파일을 찾을 수 없습니다:', fileId);
        return;
    }
    
    try {
        let blob = null;
        
        // Supabase Storage에서 파일 다운로드 (path가 있는 경우)
        if (file.path && attendanceManager.isOnline && attendanceManager.supabase) {
            const { data, error } = await attendanceManager.supabase.storage
                .from('sheet-music-files')
                .download(file.path);
            
            if (error) {
                console.error('Supabase Storage 다운로드 오류:', error);
                alert(`파일 미리보기 실패: ${error.message}`);
                return;
            }
            
            blob = data;
        } else if (file.data) {
            // Base64 데이터가 있는 경우 (오프라인 모드)
            blob = base64ToBlob(file.data, file.type);
        } else {
            alert('파일을 미리보기할 수 없습니다. 파일 정보가 없습니다.');
            return;
        }
        
        // 파일 타입에 따른 미리보기 처리
        const fileType = file.type || mimeType;
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
            // 이미지 파일 미리보기
            openImagePreview(blob, fileName);
        } else if (fileType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(fileExtension)) {
            // 오디오 파일 미리보기
            openAudioPreview(blob, fileName);
        } else if (fileType === 'application/pdf' || fileExtension === 'pdf') {
            // PDF 파일 미리보기
            openPDFPreview(blob, fileName);
        } else if (['txt', 'md', 'json', 'xml', 'csv'].includes(fileExtension)) {
            // 텍스트 파일 미리보기
            openTextPreview(blob, fileName);
        } else {
            // 지원하지 않는 파일 타입은 다운로드로 처리
            alert('이 파일 형식은 미리보기를 지원하지 않습니다. 다운로드를 시도합니다.');
            downloadFile(fileId, fileName, mimeType);
        }
        
        console.log('파일 미리보기 완료:', file.name);
        
    } catch (error) {
        console.error('파일 미리보기 오류:', error);
        alert('파일 미리보기 중 오류가 발생했습니다.');
    }
}

// 이미지 미리보기
function openImagePreview(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90vw; max-height: 90vh; padding: 20px;">
            <div class="modal-header">
                <h2>이미지 미리보기 - ${fileName}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove(); URL.revokeObjectURL('${url}')">&times;</button>
            </div>
            <div class="modal-body" style="text-align: center;">
                <img src="${url}" style="max-width: 100%; max-height: 70vh; object-fit: contain;" alt="${fileName}">
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
            URL.revokeObjectURL(url);
        }
    });
}

// 오디오 미리보기
function openAudioPreview(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2>오디오 미리보기 - ${fileName}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove(); URL.revokeObjectURL('${url}')">&times;</button>
            </div>
            <div class="modal-body" style="text-align: center;">
                <audio controls style="width: 100%;">
                    <source src="${url}" type="${blob.type}">
                    브라우저가 오디오를 지원하지 않습니다.
                </audio>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
            URL.revokeObjectURL(url);
        }
    });
}

// PDF 미리보기
function openPDFPreview(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 95vw; max-height: 95vh; padding: 10px;">
            <div class="modal-header">
                <h2>PDF 미리보기 - ${fileName}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove(); URL.revokeObjectURL('${url}')">&times;</button>
            </div>
            <div class="modal-body" style="height: 80vh;">
                <iframe src="${url}" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
            URL.revokeObjectURL(url);
        }
    });
}

// 텍스트 미리보기
function openTextPreview(blob, fileName) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 80vw; max-height: 80vh;">
                <div class="modal-header">
                    <h2>텍스트 미리보기 - ${fileName}</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <pre style="white-space: pre-wrap; word-wrap: break-word; max-height: 60vh; overflow-y: auto; background: #f8f9fa; padding: 15px; border-radius: 5px;">${e.target.result}</pre>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 모달 외부 클릭 시 닫기
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    };
    reader.readAsText(blob);
}

// 악보에서 파일 삭제
async function deleteFileFromSheet(sheetId, fileId) {
    if (confirm('정말로 이 파일을 삭제하시겠습니까?')) {
        const sheet = sheetMusicList.find(s => s.id === sheetId);
        if (sheet && sheet.files) {
            const fileToDelete = sheet.files.find(f => f.id === fileId);
            
            if (fileToDelete && fileToDelete.path) {
                try {
                    // Supabase Storage에서 파일 삭제
                    const { error } = await attendanceManager.supabase.storage
                        .from('sheet-music-files')
                        .remove([fileToDelete.path]);
                    
                    if (error) {
                        console.error('Supabase Storage 삭제 오류:', error);
                        alert(`파일 삭제 실패: ${error.message}`);
                        return;
                    }
                    
                    console.log('Supabase Storage에서 파일 삭제 완료:', fileToDelete.name);
                    
                } catch (error) {
                    console.error('파일 삭제 오류:', error);
                    alert('파일 삭제 중 오류가 발생했습니다.');
                    return;
                }
            }
            
            // 로컬 데이터에서 파일 제거
            sheet.files = sheet.files.filter(f => f.id !== fileId);
            
            // 로컬 저장
            saveSheetMusicToStorage();
            
            // Supabase 동기화
            if (attendanceManager.isOnline && attendanceManager.supabase) {
                await saveSheetMusicToSupabase();
            }
            
            // UI 업데이트
            renderSheetMusicList();
            closeFileModal();
        }
    }
}

// 악보 상세보기 모달 열기
function openSheetDetailModal(sheetId) {
    const modal = document.getElementById('sheetDetailModal');
    const title = document.getElementById('sheetDetailTitle');
    const content = document.getElementById('sheetDetailContent');
    
    const sheet = sheetMusicList.find(s => s.id === sheetId);
    if (sheet) {
        title.textContent = sheet.title;
        
        // 작곡가와 편곡가 정보
        let composerInfo = sheet.composer || '';
        if (sheet.arranger && sheet.arranger !== sheet.composer) {
            composerInfo += sheet.composer ? ` / 편곡: ${sheet.arranger}` : `편곡: ${sheet.arranger}`;
        }
        
        content.innerHTML = `
            <div class="sheet-detail-header">
                <h1 class="sheet-detail-title">${sheet.title}</h1>
                <div class="sheet-detail-subtitle">${composerInfo}</div>
            </div>
            
            <div class="sheet-detail-info">
                <div class="sheet-detail-info-item">
                    <div class="sheet-detail-info-label">작곡가</div>
                    <div class="sheet-detail-info-value">${sheet.composer || '정보 없음'}</div>
                </div>
                <div class="sheet-detail-info-item">
                    <div class="sheet-detail-info-label">편곡가</div>
                    <div class="sheet-detail-info-value">${sheet.arranger || '정보 없음'}</div>
                </div>
                <div class="sheet-detail-info-item">
                    <div class="sheet-detail-info-label">장르</div>
                    <div class="sheet-detail-info-value">${sheet.genre || '정보 없음'}</div>
                </div>
                <div class="sheet-detail-info-item">
                    <div class="sheet-detail-info-label">난이도</div>
                    <div class="sheet-detail-info-value">${sheet.difficulty || '정보 없음'}</div>
                </div>
            </div>
            
            ${sheet.notes ? `
                <div class="sheet-detail-notes">
                    <div class="sheet-detail-notes-label">📝 메모</div>
                    <div class="sheet-detail-notes-content">${sheet.notes}</div>
                </div>
            ` : ''}
            
            ${sheet.files && sheet.files.length > 0 ? `
                <div class="sheet-detail-files">
                    <div class="sheet-detail-files-label">📎 첨부파일 (${sheet.files.length}개)</div>
                    <div class="sheet-detail-files-list">
                        ${sheet.files.map(file => {
                            const fileIcon = getFileIcon(file.name);
                            return `
                                <div class="sheet-detail-file-item" onclick="downloadFile('${file.id}', '${file.name}', '${file.type}')">
                                    <div class="sheet-detail-file-icon ${fileIcon.class}">${fileIcon.icon}</div>
                                    <div class="sheet-detail-file-name">${file.name}</div>
                                    <div class="sheet-detail-file-size">${formatFileSize(file.size)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="sheet-detail-actions">
                <button class="sheet-detail-edit-btn" onclick="closeSheetDetailModal(); openEditSheetMusicForm(${sheet.id});">수정</button>
                <button class="sheet-detail-delete-btn" onclick="closeSheetDetailModal(); deleteSheetMusic(${sheet.id});">삭제</button>
            </div>
        `;
        
        modal.style.display = 'block';
    }
}

// 악보 상세보기 모달 닫기
function closeSheetDetailModal() {
    const modal = document.getElementById('sheetDetailModal');
    modal.style.display = 'none';
}

// ===== 비밀번호 인증 기능 =====

// 비밀번호 모달 열기
function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    const passwordInput = document.getElementById('passwordInput');
    
    if (modal) {
        modal.style.display = 'block';
        // 포커스를 비밀번호 입력 필드에 설정
        if (passwordInput) {
            passwordInput.focus();
            passwordInput.value = ''; // 입력 필드 초기화
        }
    }
}

// 비밀번호 모달 닫기
function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    const passwordInput = document.getElementById('passwordInput');
    
    if (modal) {
        modal.style.display = 'none';
    }
    if (passwordInput) {
        passwordInput.value = ''; // 입력 필드 초기화
    }
}

// 비밀번호 확인 처리
function handlePasswordConfirm() {
    const passwordInput = document.getElementById('passwordInput');
    const correctPassword = 'snce'; // 비밀번호는 소문자로 'snce'
    
    if (!passwordInput) {
        console.error('비밀번호 입력 필드를 찾을 수 없습니다');
        return;
    }
    
    const enteredPassword = passwordInput.value.trim().toLowerCase();
    
    if (enteredPassword === correctPassword) {
        // 비밀번호가 맞으면 악보 관리 모달 열기
        closePasswordModal();
        openSheetMusicManageModal();
        console.log('비밀번호 인증 성공');
    } else {
        // 비밀번호가 틀리면 오류 메시지 표시
        alert('비밀번호가 올바르지 않습니다.');
        passwordInput.value = ''; // 입력 필드 초기화
        passwordInput.focus(); // 다시 포커스
        console.log('비밀번호 인증 실패');
    }
}

// ==================== 연습곡 관리 기능 ====================

// 연습곡 데이터 관리
let practiceSongs = [];
let sessionPracticeSongs = {}; // { sessionNumber: [songIds] }

// 연습곡 데이터 로드 (로컬 스토리지)
function loadPracticeSongsFromStorage() {
    try {
        const stored = localStorage.getItem('practiceSongs');
        if (stored) {
            practiceSongs = JSON.parse(stored);
        }
        
        const storedSession = localStorage.getItem('sessionPracticeSongs');
        if (storedSession) {
            sessionPracticeSongs = JSON.parse(storedSession);
        }
        
        console.log('연습곡 데이터 로드 완료:', practiceSongs.length, '개');
    } catch (error) {
        console.error('연습곡 데이터 로드 실패:', error);
        practiceSongs = [];
        sessionPracticeSongs = {};
    }
}

// 연습곡 데이터 저장 (로컬 스토리지)
function savePracticeSongsToStorage() {
    try {
        localStorage.setItem('practiceSongs', JSON.stringify(practiceSongs));
        localStorage.setItem('sessionPracticeSongs', JSON.stringify(sessionPracticeSongs));
        console.log('연습곡 데이터 저장 완료');
    } catch (error) {
        console.error('연습곡 데이터 저장 실패:', error);
    }
}

// Supabase에서 연습곡 데이터 로드
async function loadPracticeSongsFromSupabase() {
    if (!attendanceManager.isOnline || !attendanceManager.supabase) {
        console.log('오프라인 상태이거나 Supabase가 초기화되지 않음');
        return false;
    }

    try {
        // 연습곡 데이터 로드
        const { data: songs, error: songsError } = await attendanceManager.supabase
            .from('practice_songs')
            .select('*')
            .order('created_at', { ascending: false });

        if (songsError) {
            console.error('연습곡 Supabase 로드 실패:', songsError);
            return false;
        }

        // 차수별 할당 데이터 로드
        const { data: assignments, error: assignmentsError } = await attendanceManager.supabase
            .from('session_practice_songs')
            .select('*');

        if (assignmentsError) {
            console.error('차수별 연습곡 할당 Supabase 로드 실패:', assignmentsError);
            return false;
        }

        // 데이터 변환
        practiceSongs = songs || [];
        
        // 차수별 할당 데이터를 객체로 변환
        sessionPracticeSongs = {};
        if (assignments) {
            assignments.forEach(assignment => {
                if (!sessionPracticeSongs[assignment.session_number]) {
                    sessionPracticeSongs[assignment.session_number] = [];
                }
                sessionPracticeSongs[assignment.session_number].push(assignment.practice_song_id);
            });
        }

        // 로컬 스토리지에도 저장
        savePracticeSongsToStorage();

        console.log('연습곡 Supabase 로드 성공:', practiceSongs.length, '개');
        return true;
    } catch (error) {
        console.error('연습곡 Supabase 로드 중 오류:', error);
        return false;
    }
}

// Supabase에 연습곡 저장
async function savePracticeSongToSupabase(songData) {
    if (!attendanceManager.isOnline || !attendanceManager.supabase) {
        console.log('오프라인 상태이거나 Supabase가 초기화되지 않음');
        return null;
    }

    try {
        const { data, error } = await attendanceManager.supabase
            .from('practice_songs')
            .upsert([songData], { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            console.error('연습곡 Supabase 저장 실패:', error);
            throw error;
        }

        console.log('연습곡 Supabase 저장 성공:', data);
        return data;
    } catch (error) {
        console.error('연습곡 Supabase 저장 중 오류:', error);
        throw error;
    }
}

// Supabase에서 연습곡 삭제
async function deletePracticeSongFromSupabase(songId) {
    if (!attendanceManager.isOnline || !attendanceManager.supabase) {
        console.log('오프라인 상태이거나 Supabase가 초기화되지 않음');
        return false;
    }

    try {
        const { error } = await attendanceManager.supabase
            .from('practice_songs')
            .delete()
            .eq('id', songId);

        if (error) {
            console.error('연습곡 Supabase 삭제 실패:', error);
            return false;
        }

        console.log('연습곡 Supabase 삭제 성공');
        return true;
    } catch (error) {
        console.error('연습곡 Supabase 삭제 중 오류:', error);
        return false;
    }
}

// Supabase에 차수별 연습곡 할당 저장
async function saveSessionPracticeSongToSupabase(sessionNumber, songId) {
    if (!attendanceManager.isOnline || !attendanceManager.supabase) {
        console.log('오프라인 상태이거나 Supabase가 초기화되지 않음');
        return false;
    }

    try {
        const { error } = await attendanceManager.supabase
            .from('session_practice_songs')
            .upsert([{
                session_number: sessionNumber,
                practice_song_id: songId
            }], { onConflict: 'session_number,practice_song_id' });

        if (error) {
            console.error('차수별 연습곡 할당 Supabase 저장 실패:', error);
            return false;
        }

        console.log('차수별 연습곡 할당 Supabase 저장 성공');
        return true;
    } catch (error) {
        console.error('차수별 연습곡 할당 Supabase 저장 중 오류:', error);
        return false;
    }
}

// Supabase에서 차수별 연습곡 할당 삭제
async function deleteSessionPracticeSongFromSupabase(sessionNumber, songId) {
    if (!attendanceManager.isOnline || !attendanceManager.supabase) {
        console.log('오프라인 상태이거나 Supabase가 초기화되지 않음');
        return false;
    }

    try {
        const { error } = await attendanceManager.supabase
            .from('session_practice_songs')
            .delete()
            .eq('session_number', sessionNumber)
            .eq('practice_song_id', songId);

        if (error) {
            console.error('차수별 연습곡 할당 Supabase 삭제 실패:', error);
            return false;
        }

        console.log('차수별 연습곡 할당 Supabase 삭제 성공');
        return true;
    } catch (error) {
        console.error('차수별 연습곡 할당 Supabase 삭제 중 오류:', error);
        return false;
    }
}

// 연습곡 관리 모달 열기
function openPracticeSongManageModal() {
    const modal = document.getElementById('practiceSongManageModal');
    modal.style.display = 'block';
    renderPracticeSongList();
}

// 연습곡 관리 모달 닫기
function closePracticeSongManageModal() {
    const modal = document.getElementById('practiceSongManageModal');
    modal.style.display = 'none';
}

// 연습곡 목록 렌더링
function renderPracticeSongList(searchTerm = '') {
    const container = document.getElementById('practiceSongManageList');
    const filteredSongs = practiceSongs.filter(song => 
        song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.composer.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filteredSongs.length === 0) {
        container.innerHTML = '<div class="no-data">등록된 연습곡이 없습니다.</div>';
        return;
    }
    
    container.innerHTML = filteredSongs.map(song => `
        <div class="practice-song-item" data-id="${song.id}">
            <div class="practice-song-header">
                <div class="practice-song-info">
                    <h3>${song.title}</h3>
                    <div class="practice-song-meta">
                        <span>작곡가: ${song.composer || '미상'}</span>
                        <span>난이도: ${song.difficulty}</span>
                    </div>
                    ${song.description ? `<div class="practice-song-description">${song.description}</div>` : ''}
                </div>
            </div>
            <div class="practice-song-actions">
                <button class="edit-practice-song-btn" data-id="${song.id}">수정</button>
                <button class="assign-practice-song-btn" data-id="${song.id}">차수 할당</button>
                <button class="delete-practice-song-btn" data-id="${song.id}">삭제</button>
            </div>
        </div>
    `).join('');
    
    // 이벤트 리스너 추가
    container.querySelectorAll('.edit-practice-song-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const songId = parseInt(e.target.dataset.id);
            editPracticeSong(songId);
        });
    });
    
    container.querySelectorAll('.delete-practice-song-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const songId = parseInt(e.target.dataset.id);
            deletePracticeSong(songId);
        });
    });
    
    container.querySelectorAll('.assign-practice-song-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const songId = parseInt(e.target.dataset.id);
            openSessionPracticeSongModal(songId);
        });
    });
}

// 연습곡 추가/수정 폼 모달 열기
function openPracticeSongFormModal(songId = null) {
    const modal = document.getElementById('practiceSongFormModal');
    const form = document.getElementById('practiceSongForm');
    const title = document.getElementById('practiceSongFormTitle');
    
    if (songId) {
        // 수정 모드
        const song = practiceSongs.find(s => s.id === songId);
        if (song) {
            title.textContent = '연습곡 수정';
            document.getElementById('practiceSongTitle').value = song.title;
            document.getElementById('practiceSongComposer').value = song.composer || '';
            document.getElementById('practiceSongDescription').value = song.description || '';
            document.getElementById('practiceSongDifficulty').value = song.difficulty || '보통';
            form.dataset.songId = songId;
        }
    } else {
        // 추가 모드
        title.textContent = '연습곡 추가';
        form.reset();
        delete form.dataset.songId;
    }
    
    modal.style.display = 'block';
}

// 연습곡 추가/수정 폼 모달 닫기
function closePracticeSongFormModal() {
    const modal = document.getElementById('practiceSongFormModal');
    modal.style.display = 'none';
    const form = document.getElementById('practiceSongForm');
    form.reset();
    delete form.dataset.songId;
}

// 연습곡 추가/수정 처리
async function handlePracticeSongSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const songData = {
        title: formData.get('title'),
        composer: formData.get('composer'),
        description: formData.get('description'),
        difficulty: formData.get('difficulty')
    };
    
    try {
        if (form.dataset.songId) {
            // 수정
            const songId = parseInt(form.dataset.songId);
            const updatedSongData = { ...songData, id: songId };
            
            // Supabase에 저장
            const savedSong = await savePracticeSongToSupabase(updatedSongData);
            if (savedSong) {
                // 로컬 데이터 업데이트
                const songIndex = practiceSongs.findIndex(s => s.id === songId);
                if (songIndex !== -1) {
                    practiceSongs[songIndex] = savedSong;
                }
                console.log('연습곡 수정 완료:', songData.title);
            }
        } else {
            // 추가
            const newSongData = { ...songData };
            
            // Supabase에 저장
            const savedSong = await savePracticeSongToSupabase(newSongData);
            if (savedSong) {
                // 로컬 데이터에 추가
                practiceSongs.unshift(savedSong);
                console.log('연습곡 추가 완료:', songData.title);
            }
        }
        
        // 로컬 스토리지에도 저장
        savePracticeSongsToStorage();
        closePracticeSongFormModal();
        renderPracticeSongList();
    } catch (error) {
        console.error('연습곡 저장 중 오류:', error);
        alert('연습곡 저장 중 오류가 발생했습니다.');
    }
}

// 연습곡 수정
function editPracticeSong(songId) {
    openPracticeSongFormModal(songId);
}

// 연습곡 삭제
async function deletePracticeSong(songId) {
    if (confirm('정말로 이 연습곡을 삭제하시겠습니까?')) {
        try {
            // Supabase에서 삭제
            const success = await deletePracticeSongFromSupabase(songId);
            if (success) {
                // 로컬 데이터에서 제거
                practiceSongs = practiceSongs.filter(s => s.id !== songId);
                
                // 차수별 할당에서도 제거
                Object.keys(sessionPracticeSongs).forEach(session => {
                    sessionPracticeSongs[session] = sessionPracticeSongs[session].filter(id => id !== songId);
                });
                
                // 로컬 스토리지에도 저장
                savePracticeSongsToStorage();
                renderPracticeSongList();
                console.log('연습곡 삭제 완료');
            } else {
                alert('연습곡 삭제 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('연습곡 삭제 중 오류:', error);
            alert('연습곡 삭제 중 오류가 발생했습니다.');
        }
    }
}

// 차수별 연습곡 설정 모달 열기
function openSessionPracticeSongModal(songId = null) {
    const modal = document.getElementById('sessionPracticeSongModal');
    modal.style.display = 'block';
    
    // 현재 선택된 회차로 설정
    const sessionSelect = document.getElementById('sessionPracticeSongSelect');
    sessionSelect.value = currentSession;
    
    renderSessionPracticeSongAssignment();
}

// 차수별 연습곡 설정 모달 닫기
function closeSessionPracticeSongModal() {
    const modal = document.getElementById('sessionPracticeSongModal');
    modal.style.display = 'none';
}

// 차수별 연습곡 할당 렌더링
function renderSessionPracticeSongAssignment() {
    const sessionSelect = document.getElementById('sessionPracticeSongSelect');
    const currentSession = parseInt(sessionSelect.value);
    
    const availableContainer = document.getElementById('availablePracticeSongs');
    const assignedContainer = document.getElementById('assignedPracticeSongs');
    
    // 현재 회차에 할당된 연습곡 ID들
    const assignedSongIds = sessionPracticeSongs[currentSession] || [];
    
    // 사용 가능한 연습곡 (할당되지 않은 것들)
    const availableSongs = practiceSongs.filter(song => !assignedSongIds.includes(song.id));
    
    // 할당된 연습곡
    const assignedSongs = practiceSongs.filter(song => assignedSongIds.includes(song.id));
    
    // 사용 가능한 연습곡 렌더링
    if (availableSongs.length === 0) {
        availableContainer.innerHTML = '<div class="no-data">사용 가능한 연습곡이 없습니다.</div>';
    } else {
        availableContainer.innerHTML = availableSongs.map(song => `
            <div class="song-item" data-song-id="${song.id}">
                <div class="song-info">
                    <h4>${song.title}</h4>
                    <p>${song.composer || '미상'} · ${song.difficulty}</p>
                </div>
                <div class="song-actions">
                    <button class="add-song-btn" data-song-id="${song.id}">추가</button>
                </div>
            </div>
        `).join('');
        
        // 추가 버튼 이벤트 리스너
        availableContainer.querySelectorAll('.add-song-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const songId = parseInt(e.target.dataset.songId);
                addSongToSession(currentSession, songId);
            });
        });
    }
    
    // 할당된 연습곡 렌더링
    if (assignedSongs.length === 0) {
        assignedContainer.innerHTML = '<div class="no-data">할당된 연습곡이 없습니다.</div>';
    } else {
        assignedContainer.innerHTML = assignedSongs.map(song => `
            <div class="song-item" data-song-id="${song.id}">
                <div class="song-info">
                    <h4>${song.title}</h4>
                    <p>${song.composer || '미상'} · ${song.difficulty}</p>
                </div>
                <div class="song-actions">
                    <button class="remove-song-btn" data-song-id="${song.id}">제거</button>
                </div>
            </div>
        `).join('');
        
        // 제거 버튼 이벤트 리스너
        assignedContainer.querySelectorAll('.remove-song-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const songId = parseInt(e.target.dataset.songId);
                removeSongFromSession(currentSession, songId);
            });
        });
    }
}

// 회차에 연습곡 추가
async function addSongToSession(sessionNumber, songId) {
    try {
        // Supabase에 저장
        const success = await saveSessionPracticeSongToSupabase(sessionNumber, songId);
        if (success) {
            // 로컬 데이터 업데이트
            if (!sessionPracticeSongs[sessionNumber]) {
                sessionPracticeSongs[sessionNumber] = [];
            }
            
            if (!sessionPracticeSongs[sessionNumber].includes(songId)) {
                sessionPracticeSongs[sessionNumber].push(songId);
                savePracticeSongsToStorage();
                renderSessionPracticeSongAssignment();
                console.log(`회차 ${sessionNumber}에 연습곡 추가 완료`);
            }
        } else {
            alert('연습곡 할당 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('연습곡 할당 중 오류:', error);
        alert('연습곡 할당 중 오류가 발생했습니다.');
    }
}

// 회차에서 연습곡 제거
async function removeSongFromSession(sessionNumber, songId) {
    try {
        // Supabase에서 삭제
        const success = await deleteSessionPracticeSongFromSupabase(sessionNumber, songId);
        if (success) {
            // 로컬 데이터 업데이트
            if (sessionPracticeSongs[sessionNumber]) {
                sessionPracticeSongs[sessionNumber] = sessionPracticeSongs[sessionNumber].filter(id => id !== songId);
                savePracticeSongsToStorage();
                renderSessionPracticeSongAssignment();
                console.log(`회차 ${sessionNumber}에서 연습곡 제거 완료`);
            }
        } else {
            alert('연습곡 할당 해제 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('연습곡 할당 해제 중 오류:', error);
        alert('연습곡 할당 해제 중 오류가 발생했습니다.');
    }
}

// 차수별 연습곡 설정 저장
function saveSessionPracticeSongAssignment() {
    savePracticeSongsToStorage();
    closeSessionPracticeSongModal();
    console.log('차수별 연습곡 설정 저장 완료');
}

// 현재 회차의 연습곡 목록 가져오기
function getCurrentSessionPracticeSongs() {
    const assignedSongIds = sessionPracticeSongs[currentSession] || [];
    return practiceSongs.filter(song => assignedSongIds.includes(song.id));
}

// 연습곡 관리 이벤트 리스너 설정
function setupPracticeSongEventListeners() {
    // 연습곡 관리 버튼
    const practiceSongManageBtn = document.getElementById('practiceSongManageBtn');
    if (practiceSongManageBtn) {
        practiceSongManageBtn.addEventListener('click', openPracticeSongManageModal);
    }
    
    // 연습곡 관리 모달 닫기
    const closePracticeSongModal = document.getElementById('closePracticeSongModal');
    if (closePracticeSongModal) {
        closePracticeSongModal.addEventListener('click', closePracticeSongManageModal);
    }
    
    // 연습곡 추가 버튼
    const addPracticeSongBtn = document.getElementById('addPracticeSongBtn');
    if (addPracticeSongBtn) {
        addPracticeSongBtn.addEventListener('click', () => openPracticeSongFormModal());
    }
    
    // 연습곡 검색
    const practiceSongSearchInput = document.getElementById('practiceSongSearchInput');
    if (practiceSongSearchInput) {
        practiceSongSearchInput.addEventListener('input', (e) => {
            renderPracticeSongList(e.target.value);
        });
    }
    
    // 연습곡 폼 모달 닫기
    const closePracticeSongFormModal = document.getElementById('closePracticeSongFormModal');
    if (closePracticeSongFormModal) {
        closePracticeSongFormModal.addEventListener('click', closePracticeSongFormModal);
    }
    
    // 연습곡 폼 취소 버튼
    const cancelPracticeSongBtn = document.getElementById('cancelPracticeSongBtn');
    if (cancelPracticeSongBtn) {
        cancelPracticeSongBtn.addEventListener('click', closePracticeSongFormModal);
    }
    
    // 연습곡 폼 제출
    const practiceSongForm = document.getElementById('practiceSongForm');
    if (practiceSongForm) {
        practiceSongForm.addEventListener('submit', handlePracticeSongSubmit);
    }
    
    // 차수별 연습곡 설정 모달 닫기
    const closeSessionPracticeSongModal = document.getElementById('closeSessionPracticeSongModal');
    if (closeSessionPracticeSongModal) {
        closeSessionPracticeSongModal.addEventListener('click', closeSessionPracticeSongModal);
    }
    
    // 회차 선택 변경
    const sessionPracticeSongSelect = document.getElementById('sessionPracticeSongSelect');
    if (sessionPracticeSongSelect) {
        sessionPracticeSongSelect.addEventListener('change', renderSessionPracticeSongAssignment);
    }
    
    // 차수별 연습곡 설정 저장
    const saveSessionPracticeSongBtn = document.getElementById('saveSessionPracticeSongBtn');
    if (saveSessionPracticeSongBtn) {
        saveSessionPracticeSongBtn.addEventListener('click', saveSessionPracticeSongAssignment);
    }
    
    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', (e) => {
        const practiceSongModal = document.getElementById('practiceSongManageModal');
        const practiceSongFormModal = document.getElementById('practiceSongFormModal');
        const sessionPracticeSongModal = document.getElementById('sessionPracticeSongModal');
        
        if (e.target === practiceSongModal) {
            closePracticeSongManageModal();
        }
        if (e.target === practiceSongFormModal) {
            closePracticeSongFormModal();
        }
        if (e.target === sessionPracticeSongModal) {
            closeSessionPracticeSongModal();
        }
    });
}

