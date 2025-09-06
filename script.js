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
    { no: 19, instrument: '플룻', name: '민휘' }
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
                const { error } = await this.supabase
                    .from('attendance_records')
                    .upsert({
                        member_id: memberNo,
                        session_number: session,
                        status: status
                    }, {
                        onConflict: 'session_number,member_id'
                    });

                if (error) {
                    console.error('Supabase 출석 상태 저장 실패:', error);
                } else {
                    console.log('Supabase 출석 상태 저장 완료');
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
            
            // 출석 데이터를 Supabase 형식으로 변환
            const attendanceRecords = [];
            for (const [session, sessionData] of Object.entries(this.data)) {
                for (const [memberNo, status] of Object.entries(sessionData)) {
                    attendanceRecords.push({
                        member_id: parseInt(memberNo),
                        session_number: parseInt(session),
                        status: status
                    });
                }
            }

            if (attendanceRecords.length > 0) {
                const { error } = await this.supabase
                    .from('attendance_records')
                    .upsert(attendanceRecords, {
                        onConflict: 'session_number,member_id'
                    });

                if (error) {
                    console.error('Supabase 저장 실패:', error);
                    this.updateSyncStatus('offline', '저장 실패: ' + error.message);
                    return false;
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
                .select('*');

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
                    cloudData[record.session_number][record.member_id] = record.status;
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

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    startRealTimeSync();
});

function initializeApp() {
    renderMemberList();
    updateSummary();
    updateSessionDates();
    
    // 동기화 상태 초기화
    attendanceManager.updateSyncStatus('online', '동기화 준비됨');
    attendanceManager.updateSyncTime();
    
    // 데이터 업데이트 이벤트 리스너
    window.addEventListener('attendanceDataUpdated', function() {
        renderMemberList();
        updateSummary();
    });
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
}

function renderMemberList() {
    const memberList = document.getElementById('memberList');
    memberList.innerHTML = '';

    members.forEach(member => {
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
