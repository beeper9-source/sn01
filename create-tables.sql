-- 수내체임버앙상블 출석부 데이터베이스 테이블 생성 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. 멤버 테이블 생성
CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    no INTEGER UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    instrument VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 세션 정보 테이블 생성 (회차별 정보 관리)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_number INTEGER UNIQUE NOT NULL,
    session_date DATE,
    is_holiday BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 출석 기록 테이블 생성
CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    session_number INTEGER NOT NULL,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL CHECK (status IN ('present', 'absent', 'pending', 'holiday')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_number, member_id)
);

-- 4. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_number);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance_records(member_id);
CREATE INDEX IF NOT EXISTS idx_members_instrument ON members(instrument);
CREATE INDEX IF NOT EXISTS idx_members_no ON members(no);
CREATE INDEX IF NOT EXISTS idx_sessions_number ON sessions(session_number);

-- 5. RLS (Row Level Security) 정책 설정
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- 6. 모든 사용자가 읽기/쓰기 가능하도록 정책 설정 (공개 앱)
CREATE POLICY "Enable all operations for all users on members" 
    ON members FOR ALL USING (true);

CREATE POLICY "Enable all operations for all users on attendance_records" 
    ON attendance_records FOR ALL USING (true);

CREATE POLICY "Enable all operations for all users on sessions" 
    ON sessions FOR ALL USING (true);

-- 7. 업데이트 시간 자동 갱신을 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. 트리거 생성
DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at 
    BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER update_attendance_records_updated_at 
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. 기본 멤버 데이터 삽입
INSERT INTO members (no, name, instrument) VALUES
(2, '김희선', '피아노'),
(3, '김호식', '바이올린'),
(4, '목진혜', '바이올린'),
(5, '성지윤', '바이올린'),
(6, '나무홍', '바이올린'),
(7, '조유진', '첼로'),
(8, '김진희', '첼로'),
(9, '이령', '첼로'),
(10, '이정헌', '첼로'),
(11, '김구', '첼로'),
(12, '노동일', '클라리넷'),
(13, '조원양', '클라리넷'),
(14, '신세연', '클라리넷'),
(15, '이상규', '클라리넷'),
(16, '이인섭', '클라리넷'),
(17, '김병민', '플룻'),
(18, '허진희', '플룻'),
(19, '민휘', '플룻')
ON CONFLICT (no) DO NOTHING;

-- 10. 기본 세션 데이터 삽입 (2025년 가을학기)
INSERT INTO sessions (session_number, session_date, is_holiday, notes) VALUES
(1, '2025-09-07', FALSE, '1회차'),
(2, '2025-09-14', FALSE, '2회차'),
(3, '2025-09-21', FALSE, '3회차'),
(4, '2025-09-28', FALSE, '4회차'),
(5, '2025-10-05', TRUE, '휴강'),
(6, '2025-10-12', FALSE, '5회차'),
(7, '2025-10-19', FALSE, '6회차'),
(8, '2025-10-26', FALSE, '7회차'),
(9, '2025-11-02', FALSE, '8회차'),
(10, '2025-11-09', FALSE, '9회차'),
(11, '2025-11-16', FALSE, '10회차'),
(12, '2025-11-30', FALSE, '11회차 - 종강')
ON CONFLICT (session_number) DO NOTHING;

-- 11. 테이블 생성 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '수내체임버앙상블 출석부 데이터베이스 테이블 생성 완료!';
    RAISE NOTICE '생성된 테이블: members, sessions, attendance_records';
    RAISE NOTICE '기본 데이터 삽입 완료: 18명의 멤버, 12회차 세션 정보';
END $$;

