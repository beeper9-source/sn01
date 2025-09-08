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
const HOLIDAY_SESSIONS = [5]; // 5회차 휴강

// 출석 데이터 저장소 (Supabase 사용)
class AttendanceManager {
    constructor() {
        this.storageKey = 'chamber_attendance_local'; // 로컬 백업용
        this.data = this.loadData();
        this.isOnline = navigator.onLine;
        this.lastSyncTime = 0;
        this.syncInterval = null;
        
        // Supabase 클라이언트 확인
        if (typeof window.supabaseClient !== 'undefined') {
            this.supabase = window.supabaseClient;
            console.log('Supabase 클라이언트 연결 완료');
            this.setupCloudSync();
        } else {
            console.log('Supabase 클라이언트가 로드되지 않았습니다. 로컬 모드로 작동합니다.');
            this.supabase = null;
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
        return this.data[session]?.[memberNo] || ATTENDANCE_TYPES.PENDING;
    }

    async setAttendance(session, memberNo, status) {
        // 휴강일인 경우 출석 상태 변경 불가
        if (HOLIDAY_SESSIONS.includes(session)) {
            return false;
        }
        
        if (!this.data[session]) {
            this.data[session] = {};
        }
        this.data[session][memberNo] = status;
        
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
            const status = sessionData[member.no] || ATTENDANCE_TYPES.PENDING;
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
            const status = sessionData[member.no] || ATTENDANCE_TYPES.PENDING;
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
                for (const [memberNo, status] of Object.entries(sessionData)) {
                    const supabaseId = await mapMemberNoToSupabaseId(parseInt(memberNo));
                    if (supabaseId) {
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
                .select('session_number, member_id, status');

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
                        cloudData[record.session_number][memberNo] = record.status;
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
            const now = new Date();
            const timeString = now.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            syncTimeElement.textContent = timeString;
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
    startRealTimeSync();
});

function initializeApp() {
    // 회원 데이터 로드 (저장된 데이터가 있으면 사용)
    loadMembersFromStorage();
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

    const currentStatus = attendanceManager.getAttendance(currentSession, member.no);
    const isHoliday = HOLIDAY_SESSIONS.includes(currentSession);

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
        // 일반 수업일인 경우
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
            // 일반 수업일인 경우
            document.getElementById(`${instrumentKey}-present`).textContent = summary.present;
            document.getElementById(`${instrumentKey}-absent`).textContent = summary.absent;
            document.getElementById(`${instrumentKey}-pending`).textContent = summary.pending;
            document.getElementById(`${instrumentKey}-holiday-item`).style.display = 'none';
        }
        // 누계출석율 표시 제거
        const rateElement = document.getElementById(`${instrumentKey}-rate`);
        if (rateElement) {
            rateElement.textContent = '';
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

// 누계출석율 계산 함수 제거됨

function updateSessionDates() {
    const startDate = new Date('2025-09-07'); // 2025년 9월 7일 일요일
    const sessionSelect = document.getElementById('sessionSelect');
    
    sessionSelect.innerHTML = '';
    
    for (let i = 1; i <= 12; i++) {
        const sessionDate = new Date(startDate);
        sessionDate.setDate(startDate.getDate() + (i - 1) * 7);
        
        const option = document.createElement('option');
        option.value = i;
        
        if (i === 5) {
            // 5회차는 휴강으로 표시
            option.textContent = `휴강 (${formatDate(sessionDate)})`;
        } else if (i === 12) {
            // 12회차는 종강으로 표시 (11월 30일)
            const endDate = new Date('2025-11-30');
            option.textContent = `11회차 (${formatDate(endDate)}) - 종강`;
        } else if (i >= 6) {
            // 6회차부터는 실제 회차 번호를 1씩 빼서 표시
            const actualSession = i - 1;
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
    
    // 휴강일(5회차)을 고려하여 조정
    if (nextSession > 5) {
        nextSession = nextSession + 1; // 휴강일 이후는 회차 번호를 1 증가
        console.log('휴강일 고려 후 회차:', nextSession);
    }
    
    // 최대 회차 제한
    if (nextSession > 12) {
        nextSession = 12;
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
    
    // URL 파라미터로 강제 설정 가능 (테스트용)
    const urlParams = new URLSearchParams(window.location.search);
    const forceSession = urlParams.get('session');
    if (forceSession) {
        defaultSession = parseInt(forceSession);
        console.log(`URL 파라미터로 강제 설정: ${defaultSession}회차`);
    } else {
        // 현재 날짜를 기준으로 회차 계산 (더 정확한 방법)
        const now = new Date();
        const startDate = new Date('2025-09-07'); // 2025년 9월 7일 일요일 (1회차)
        
        // 현재 날짜가 시작일 이전인 경우
        if (now < startDate) {
            defaultSession = 1;
            console.log('시작일 이전 - 1회차 설정');
        } else {
            // 현재 날짜와 시작일 사이의 주차 계산
            const timeDiff = now.getTime() - startDate.getTime();
            const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const weeksDiff = Math.floor(daysDiff / 7);
            
            console.log('현재 주차:', weeksDiff + 1);
            
            // 일요일 저녁 9시 이후인지 확인 (KST 기준)
            const isAfter9PM = isAfterSunday9PM_KST();
            
            if (isAfter9PM) {
                // 다음주 일요일 회차 계산
                let nextSession = weeksDiff + 2; // 현재 주차 + 1
                
                // 휴강일(5회차)을 고려하여 조정
                if (nextSession > 5) {
                    nextSession = nextSession + 1;
                }
                
                // 최대 회차 제한
                if (nextSession > 12) {
                    nextSession = 12;
                }
                
                defaultSession = nextSession;
                console.log(`일요일 저녁 9시 이후 - 다음주 일요일 회차(${defaultSession}회차) 설정`);
            } else {
                // 현재 주차 또는 다음 주차 설정
                let currentSession = weeksDiff + 1;
                
                // 휴강일(5회차)을 고려하여 조정
                if (currentSession > 5) {
                    currentSession = currentSession + 1;
                }
                
                // 최대 회차 제한
                if (currentSession > 12) {
                    currentSession = 12;
                }
                
                defaultSession = currentSession;
                console.log(`일요일 저녁 9시 이전 - 현재 주차(${defaultSession}회차) 설정`);
            }
        }
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

// 테스트용 출석 데이터 추가 함수 (디버깅용)
function addTestAttendanceData() {
    console.log('=== 테스트 출석 데이터 추가 ===');
    
    // 바이올린 멤버들의 1-3회차 출석 데이터 추가
    const violinMembers = members.filter(m => m.instrument === '바이올린');
    
    violinMembers.forEach(member => {
        // 1회차: 출석
        attendanceManager.setAttendance(1, member.no, 'present');
        // 2회차: 출석
        attendanceManager.setAttendance(2, member.no, 'present');
        // 3회차: 결석
        attendanceManager.setAttendance(3, member.no, 'absent');
    });
    
    console.log('테스트 출석 데이터 추가 완료');
    console.log('현재 출석 데이터:', attendanceManager.data);
    
    // UI 업데이트
    renderMemberList();
    updateSummary();
}

// 개발자 도구에서 테스트할 수 있도록 전역 함수로 등록
window.addTestAttendanceData = addTestAttendanceData;

// ==================== 회원 관리 기능 ====================

// 회원 관리 이벤트 리스너 설정
function setupMemberManagementEvents() {
    // 회원 관리 버튼
    const memberManageBtn = document.getElementById('memberManageBtn');
    if (memberManageBtn) {
        memberManageBtn.addEventListener('click', openMemberManageModal);
    }

    // 모달 닫기 버튼들
    const closeModal = document.getElementById('closeModal');
    const closeFormModal = document.getElementById('closeFormModal');
    const cancelMemberBtn = document.getElementById('cancelMemberBtn');

    if (closeModal) {
        closeModal.addEventListener('click', closeMemberManageModal);
    }
    if (closeFormModal) {
        closeFormModal.addEventListener('click', closeMemberFormModal);
    }
    if (cancelMemberBtn) {
        cancelMemberBtn.addEventListener('click', closeMemberFormModal);
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

    // 모달 외부 클릭 시 닫기
    const memberManageModal = document.getElementById('memberManageModal');
    const memberFormModal = document.getElementById('memberFormModal');

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
    const member = members.find(m => m.no === memberId);
    if (!member) return;

    editingMemberId = memberId;
    document.getElementById('memberFormTitle').textContent = '회원 수정';
    document.getElementById('saveMemberBtn').textContent = '수정';
    
    // 폼에 기존 데이터 채우기
    document.getElementById('memberName').value = member.name;
    document.getElementById('memberInstrument').value = member.instrument;
    
    openMemberFormModal();
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
    
    const formData = new FormData(e.target);
    const name = formData.get('name').trim();
    const instrument = formData.get('instrument');

    if (!name || !instrument) {
        alert('이름과 악기를 모두 입력해주세요.');
        return;
    }

    if (editingMemberId) {
        // 회원 수정
        updateMember(editingMemberId, name, instrument);
    } else {
        // 회원 추가
        addMember(name, instrument);
    }

    closeMemberFormModal();
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
    
    console.log('회원 추가됨:', newMember);
}

// 회원 수정
function updateMember(memberId, name, instrument) {
    const memberIndex = members.findIndex(m => m.no === memberId);
    if (memberIndex === -1) return;

    const oldMember = members[memberIndex];
    members[memberIndex] = {
        ...oldMember,
        name: name,
        instrument: instrument
    };

    saveMembersToStorage();
    // Supabase에도 반영
    if (attendanceManager.isOnline && attendanceManager.supabase) {
        upsertMemberToSupabase(members[memberIndex]);
    }
    renderMemberManageList();
    renderMemberList();
    updateSummary();
    
    console.log('회원 수정됨:', members[memberIndex]);
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
        const { error } = await attendanceManager.supabase
            .from('members')
            .upsert({ no: member.no, name: member.name, instrument: member.instrument });
        if (error) {
            console.error('Supabase 멤버 upsert 실패:', error);
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
                }
            } catch {}
        }
    } catch (e) {
        console.error('Supabase 멤버 upsert 오류:', e);
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
        console.log('회원 데이터 저장 완료');
    } catch (error) {
        console.error('회원 데이터 저장 실패:', error);
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
