// Supabase 기반 출석 관리자
class SupabaseAttendanceManager {
    constructor() {
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
            return true;
        } catch (e) {
            console.error('로컬 저장 실패:', e);
            return false;
        }
    }

    // 데이터베이스 초기화 (멤버 데이터 삽입)
    async initializeDatabase() {
        try {
            // 멤버 데이터가 이미 있는지 확인
            const { data: existingMembers, error: checkError } = await this.supabase
                .from('members')
                .select('id')
                .limit(1);

            if (checkError) {
                console.error('멤버 데이터 확인 실패:', checkError);
                return;
            }

            // 멤버 데이터가 없으면 삽입
            if (!existingMembers || existingMembers.length === 0) {
                console.log('멤버 데이터 초기화 중...');
                
                const { error: insertError } = await this.supabase
                    .from('members')
                    .insert(members.map(member => ({
                        no: member.no,
                        name: member.name,
                        instrument: member.instrument
                    })));

                if (insertError) {
                    console.error('멤버 데이터 삽입 실패:', insertError);
                } else {
                    console.log('멤버 데이터 초기화 완료');
                }
            }

            // 세션 데이터 초기화
            await this.initializeSessions();

        } catch (error) {
            console.error('데이터베이스 초기화 오류:', error);
        }
    }

    // 세션 데이터 초기화
    async initializeSessions() {
        try {
            const { data: existingSessions, error: checkError } = await this.supabase
                .from('sessions')
                .select('session_number')
                .limit(1);

            if (checkError) {
                console.error('세션 데이터 확인 실패:', checkError);
                return;
            }

            if (!existingSessions || existingSessions.length === 0) {
                console.log('세션 데이터 초기화 중...');
                
                const sessionData = [];
                const startDate = new Date('2025-09-07');
                
                for (let i = 1; i <= 12; i++) {
                    const sessionDate = new Date(startDate);
                    sessionDate.setDate(startDate.getDate() + (i - 1) * 7);
                    
                    sessionData.push({
                        session_number: i,
                        session_date: sessionDate.toISOString().split('T')[0],
                        is_holiday: i === 5, // 5회차 휴강
                        notes: i === 5 ? '휴강' : (i === 12 ? '종강' : null)
                    });
                }

                const { error: insertError } = await this.supabase
                    .from('sessions')
                    .insert(sessionData);

                if (insertError) {
                    console.error('세션 데이터 삽입 실패:', insertError);
                } else {
                    console.log('세션 데이터 초기화 완료');
                }
            }
        } catch (error) {
            console.error('세션 데이터 초기화 오류:', error);
        }
    }

    // 출석 상태 조회
    async getAttendance(session, memberNo) {
        // 휴강일인 경우 휴강 상태 반환
        if (HOLIDAY_SESSIONS.includes(session)) {
            return ATTENDANCE_TYPES.HOLIDAY;
        }

        // 로컬 데이터에서 먼저 확인
        const localStatus = this.localData[session]?.[memberNo];
        if (localStatus) {
            return localStatus;
        }

        // 온라인인 경우 Supabase에서 조회
        if (this.isOnline) {
            try {
                const { data: member, error: memberError } = await this.supabase
                    .from('members')
                    .select('id')
                    .eq('no', memberNo)
                    .single();

                if (memberError) {
                    console.error('멤버 조회 실패:', memberError);
                    return ATTENDANCE_TYPES.PENDING;
                }

                const { data: attendance, error: attendanceError } = await this.supabase
                    .from('attendance_records')
                    .select('status')
                    .eq('session_number', session)
                    .eq('member_id', member.id)
                    .single();

                if (attendanceError && attendanceError.code !== 'PGRST116') {
                    console.error('출석 기록 조회 실패:', attendanceError);
                    return ATTENDANCE_TYPES.PENDING;
                }

                const status = attendance?.status || ATTENDANCE_TYPES.PENDING;
                
                // 로컬 데이터에 캐시
                if (!this.localData[session]) {
                    this.localData[session] = {};
                }
                this.localData[session][memberNo] = status;
                this.saveLocalData();

                return status;
            } catch (error) {
                console.error('출석 상태 조회 오류:', error);
                return ATTENDANCE_TYPES.PENDING;
            }
        }

        return ATTENDANCE_TYPES.PENDING;
    }

    // 출석 상태 설정
    async setAttendance(session, memberNo, status) {
        // 휴강일인 경우 출석 상태 변경 불가
        if (HOLIDAY_SESSIONS.includes(session)) {
            return false;
        }

        // 로컬 데이터 업데이트
        if (!this.localData[session]) {
            this.localData[session] = {};
        }
        this.localData[session][memberNo] = status;
        this.saveLocalData();

        // 온라인인 경우 Supabase에 저장
        if (this.isOnline) {
            try {
                const { data: member, error: memberError } = await this.supabase
                    .from('members')
                    .select('id')
                    .eq('no', memberNo)
                    .single();

                if (memberError) {
                    console.error('멤버 조회 실패:', memberError);
                    return false;
                }

                const { error: upsertError } = await this.supabase
                    .from('attendance_records')
                    .upsert({
                        session_number: session,
                        member_id: member.id,
                        status: status
                    });

                if (upsertError) {
                    console.error('출석 기록 저장 실패:', upsertError);
                    return false;
                }

                console.log('출석 기록 저장 완료:', { session, memberNo, status });
            } catch (error) {
                console.error('출석 상태 설정 오류:', error);
                return false;
            }
        }

        this.notifyChange(session, memberNo, status);
        return true;
    }

    // 세션 요약 조회
    async getSessionSummary(session) {
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

        // 로컬 데이터에서 집계
        const sessionData = this.localData[session] || {};
        members.forEach(member => {
            const status = sessionData[member.no] || ATTENDANCE_TYPES.PENDING;
            summary[status]++;
        });

        return summary;
    }

    // 악기별 요약 조회
    async getInstrumentSummary(session) {
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
        const sessionData = this.localData[session] || {};
        members.forEach(member => {
            const status = sessionData[member.no] || ATTENDANCE_TYPES.PENDING;
            instrumentSummary[member.instrument][status]++;
            instrumentSummary[member.instrument].total++;
        });

        return instrumentSummary;
    }

    // 클라우드 동기화 설정
    setupCloudSync() {
        console.log('Supabase 클라우드 동기화 설정');
        
        // 초기 동기화 (페이지 로드 시)
        if (this.isOnline) {
            setTimeout(() => {
                this.syncFromCloud();
            }, 2000);
        }
        
        // 주기적으로 클라우드에서 데이터 동기화 (10초마다 - 더 빠른 동기화)
        this.syncInterval = setInterval(() => {
            if (this.isOnline) {
                console.log('자동 동기화 실행 중...');
                this.updateSyncStatus('syncing', '동기화 중...');
                this.syncFromCloud();
            } else {
                console.log('오프라인 상태 - 동기화 건너뜀');
                this.updateSyncStatus('offline', '오프라인 상태');
            }
        }, 10000);
        
        // 실시간 구독 설정
        this.setupRealtimeSubscription();
    }

    // 클라우드에서 데이터 동기화
    async syncFromCloud() {
        if (!this.isOnline) {
            console.log('오프라인 상태 - 클라우드 동기화 건너뜀');
            return false;
        }

        try {
            console.log('Supabase에서 데이터 동기화 시도...');
            
            // 모든 출석 기록 조회
            const { data: attendanceRecords, error } = await this.supabase
                .from('attendance_records')
                .select(`
                    session_number,
                    status,
                    members!inner(no)
                `);

            if (error) {
                console.error('출석 기록 조회 실패:', error);
                this.updateSyncStatus('offline', '동기화 실패');
                return false;
            }

            // 데이터 변환 및 로컬 저장
            const cloudData = {};
            attendanceRecords.forEach(record => {
                const session = record.session_number;
                const memberNo = record.members.no;
                const status = record.status;
                
                if (!cloudData[session]) {
                    cloudData[session] = {};
                }
                cloudData[session][memberNo] = status;
            });

            // 로컬 데이터와 비교하여 업데이트
            if (JSON.stringify(cloudData) !== JSON.stringify(this.localData)) {
                console.log('Supabase에서 데이터 업데이트 감지 - UI 업데이트');
                this.localData = cloudData;
                this.saveLocalData();
                this.notifyUIUpdate();
                this.updateSyncStatus('online', '데이터 업데이트됨');
                this.updateSyncTime();
            } else {
                console.log('데이터 변경 없음');
                this.updateSyncStatus('online', '동기화 완료');
            }
            
            this.lastSyncTime = Date.now();
            return true;
        } catch (error) {
            console.error('Supabase 동기화 오류:', error);
            this.updateSyncStatus('offline', '네트워크 오류');
            return false;
        }
    }

    // 데이터 저장
    async saveData() {
        // 로컬 저장
        const localSuccess = this.saveLocalData();
        
        // 온라인인 경우 Supabase에 저장
        let cloudSuccess = true;
        if (this.isOnline) {
            cloudSuccess = await this.syncToCloud();
        }
        
        return localSuccess && cloudSuccess;
    }

    // 클라우드에 데이터 동기화
    async syncToCloud() {
        if (!this.isOnline) {
            console.log('오프라인 상태 - 클라우드 저장 건너뜀');
            this.updateSyncStatus('offline', '오프라인 상태');
            return false;
        }

        try {
            console.log('Supabase에 데이터 저장 시도...');
            
            // 모든 세션의 출석 데이터를 Supabase에 저장
            for (const [session, sessionData] of Object.entries(this.localData)) {
                for (const [memberNo, status] of Object.entries(sessionData)) {
                    const { data: member, error: memberError } = await this.supabase
                        .from('members')
                        .select('id')
                        .eq('no', parseInt(memberNo))
                        .single();

                    if (memberError) {
                        console.error('멤버 조회 실패:', memberError);
                        continue;
                    }

                    const { error: upsertError } = await this.supabase
                        .from('attendance_records')
                        .upsert({
                            session_number: parseInt(session),
                            member_id: member.id,
                            status: status
                        });

                    if (upsertError) {
                        console.error('출석 기록 저장 실패:', upsertError);
                        return false;
                    }
                }
            }

            console.log('Supabase에 데이터 저장 완료');
            this.lastSyncTime = Date.now();
            this.updateSyncStatus('online', '동기화 완료');
            this.updateSyncTime();
            return true;
        } catch (error) {
            console.error('Supabase 저장 오류:', error);
            this.updateSyncStatus('offline', '네트워크 오류: ' + error.message);
            return false;
        }
    }

    // UI 업데이트 알림
    notifyUIUpdate() {
        window.dispatchEvent(new CustomEvent('attendanceDataUpdated'));
    }

    // 동기화 상태 업데이트
    updateSyncStatus(status, message) {
        const indicator = document.getElementById('syncIndicator');
        const text = document.getElementById('syncText');
        
        if (indicator && text) {
            indicator.className = `sync-indicator ${status}`;
            text.textContent = message;
        }
    }

    // 동기화 시간 업데이트
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

    // 변경사항 알림
    notifyChange(session, memberNo, status) {
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

    // 변경사항 리스너
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

    // 실시간 구독 설정
    setupRealtimeSubscription() {
        if (!this.supabase) {
            console.log('Supabase 클라이언트가 없어서 실시간 구독을 설정할 수 없습니다.');
            return;
        }

        try {
            // attendance_records 테이블의 변경사항을 실시간으로 구독
            this.supabase
                .channel('attendance_changes')
                .on('postgres_changes', 
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'attendance_records' 
                    }, 
                    (payload) => {
                        console.log('실시간 변경사항 감지:', payload);
                        this.handleRealtimeChange(payload);
                    }
                )
                .subscribe((status) => {
                    console.log('실시간 구독 상태:', status);
                    if (status === 'SUBSCRIBED') {
                        this.updateSyncStatus('online', '실시간 동기화 활성화');
                    } else if (status === 'CHANNEL_ERROR') {
                        this.updateSyncStatus('offline', '실시간 동기화 오류');
                    }
                });
        } catch (error) {
            console.error('실시간 구독 설정 오류:', error);
        }
    }

    // 실시간 변경사항 처리
    handleRealtimeChange(payload) {
        try {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            
            console.log(`실시간 변경사항 처리: ${eventType}`, { newRecord, oldRecord });
            
            // 로컬 데이터 업데이트
            if (newRecord) {
                // 멤버 번호 조회를 위해 멤버 정보가 필요하지만, 
                // 실시간 이벤트에서는 member_id만 제공되므로
                // 전체 동기화를 실행하여 데이터 일관성 유지
                this.syncFromCloud();
            }
            
            // UI 업데이트 알림
            this.notifyUIUpdate();
            
        } catch (error) {
            console.error('실시간 변경사항 처리 오류:', error);
        }
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
