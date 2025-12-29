console.log('=== supabase-attendance-manager.js 로드 시작 ===');

// 출석 상태 타입
const ATTENDANCE_TYPES = {
    PRESENT: 'present',
    ABSENT: 'absent',
    PENDING: 'pending',
    HOLIDAY: 'holiday'
};

// 휴강일 설정
const HOLIDAY_SESSIONS = []; // 휴강 없음

console.log('상수 정의 완료:', { ATTENDANCE_TYPES, HOLIDAY_SESSIONS });

// Supabase 기반 출석 관리자
class SupabaseAttendanceManager {
    constructor() {
        console.log('SupabaseAttendanceManager 생성자 호출');
        
        this.storageKey = 'chamber_attendance_local';
        this.localData = this.loadLocalData();
        this.isOnline = navigator.onLine;
        this.lastSyncTime = 0;
        this.syncInterval = null;
        
        // Supabase 클라이언트 확인
        if (typeof window.supabaseClient === 'undefined') {
            console.error('Supabase 클라이언트가 로드되지 않았습니다.');
            return;
        }
        
        this.supabase = window.supabaseClient;
        console.log('Supabase 클라이언트 연결 완료');
        
        this.setupCloudSync();
        this.initializeDatabase();
    }

    // 로컬 데이터 로드
    loadLocalData() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('로컬 데이터 로드 실패:', e);
            }
        }
        return {};
    }

    // 로컬 데이터 저장
    saveLocalData() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.localData));
        } catch (e) {
            console.error('로컬 데이터 저장 실패:', e);
        }
    }

    // 데이터베이스 초기화
    async initializeDatabase() {
        try {
            console.log('데이터베이스 초기화 시작');
            
            // 멤버 데이터가 있는지 확인
            if (typeof members === 'undefined' || !members || members.length === 0) {
                console.error('멤버 데이터가 없습니다.');
                return;
            }

            // 멤버 데이터를 데이터베이스에 저장
            const { data, error } = await this.supabase
                .from('members')
                .select('*');

            if (error) {
                console.error('멤버 데이터 조회 오류:', error);
                return;
            }

            // 멤버 데이터가 없으면 삽입
            if (!data || data.length === 0) {
                console.log('멤버 데이터 삽입 시작');
                const { error: insertError } = await this.supabase
                    .from('members')
                    .insert(members);

                if (insertError) {
                    console.error('멤버 데이터 삽입 오류:', insertError);
                } else {
                    console.log('멤버 데이터 삽입 완료');
                }
            } else {
                console.log('멤버 데이터 이미 존재:', data.length, '명');
            }

        } catch (error) {
            console.error('데이터베이스 초기화 오류:', error);
        }
    }

    // 클라우드 동기화 설정
    setupCloudSync() {
        console.log('클라우드 동기화 설정 시작');
        
        // 온라인 상태 변경 감지
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncToCloud();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });

        // 주기적 동기화 (5분마다)
        this.syncInterval = setInterval(() => {
            if (this.isOnline) {
                this.syncToCloud();
            }
        }, 5 * 60 * 1000);
    }

    // 클라우드로 동기화
    async syncToCloud() {
        if (!this.isOnline) {
            console.log('오프라인 상태 - 동기화 건너뜀');
            return;
        }

        try {
            console.log('클라우드 동기화 시작');
            
            // 출석 기록 동기화
            for (const [key, attendance] of Object.entries(this.localData)) {
                if (attendance && attendance.member_id && attendance.session) {
                    const { error } = await this.supabase
                        .from('attendance_records')
                        .upsert({
                            member_id: attendance.member_id,
                            session: attendance.session,
                            status: attendance.status,
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'member_id,session'
                        });

                    if (error) {
                        console.error('출석 기록 동기화 오류:', error);
                    }
                }
            }

            this.lastSyncTime = Date.now();
            console.log('클라우드 동기화 완료');

        } catch (error) {
            console.error('클라우드 동기화 오류:', error);
        }
    }

    // 클라우드에서 동기화
    async syncFromCloud() {
        if (!this.isOnline) {
            console.log('오프라인 상태 - 동기화 건너뜀');
            return;
        }

        try {
            console.log('클라우드에서 동기화 시작');
            
            const { data, error } = await this.supabase
                .from('attendance_records')
                .select('*');

            if (error) {
                console.error('출석 기록 조회 오류:', error);
                return;
            }

            // 로컬 데이터 업데이트
            if (data) {
                data.forEach(record => {
                    const key = `${record.member_id}_${record.session}`;
                    this.localData[key] = {
                        member_id: record.member_id,
                        session: record.session,
                        status: record.status
                    };
                });

                this.saveLocalData();
                console.log('클라우드에서 동기화 완료:', data.length, '개 기록');
            }

        } catch (error) {
            console.error('클라우드에서 동기화 오류:', error);
        }
    }

    // 출석 상태 설정
    async setAttendance(memberId, session, status) {
        console.log(`출석 상태 설정: ${memberId}, ${session}, ${status}`);
        
        const key = `${memberId}_${session}`;
        this.localData[key] = {
            member_id: memberId,
            session: session,
            status: status
        };

        this.saveLocalData();

        // 온라인 상태면 클라우드에 동기화
        if (this.isOnline) {
            try {
                const { error } = await this.supabase
                    .from('attendance_records')
                    .upsert({
                        member_id: memberId,
                        session: session,
                        status: status,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'member_id,session'
                    });

                if (error) {
                    console.error('출석 상태 저장 오류:', error);
                } else {
                    console.log('출석 상태 저장 완료');
                }
            } catch (error) {
                console.error('출석 상태 저장 오류:', error);
            }
        }

        return this.localData[key];
    }

    // 출석 상태 조회
    getAttendance(memberId, session) {
        const key = `${memberId}_${session}`;
        return this.localData[key] || { status: 'pending' };
    }

    // 모든 출석 데이터 조회
    getAllAttendance() {
        return this.localData;
    }

    // UI 업데이트 알림
    notifyUIUpdate() {
        const event = new CustomEvent('attendanceUpdated', {
            detail: { data: this.localData }
        });
        window.dispatchEvent(event);
    }

    // 구독 정리
    cleanup() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        if (this.supabase) {
            this.supabase.removeAllChannels();
        }
    }
}

console.log('SupabaseAttendanceManager 클래스 정의 완료');

// 전역으로 사용할 수 있도록 등록
window.SupabaseAttendanceManager = SupabaseAttendanceManager;

console.log('=== supabase-attendance-manager.js 로드 완료 ===');
console.log('SupabaseAttendanceManager 클래스 등록됨:', typeof window.SupabaseAttendanceManager !== 'undefined');