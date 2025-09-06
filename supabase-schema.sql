-- 수내체임버앙상블 출석부 데이터베이스 스키마

-- 멤버 테이블
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    no INTEGER UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    instrument VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 출석 기록 테이블
CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    session_number INTEGER NOT NULL,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL CHECK (status IN ('present', 'absent', 'pending', 'holiday')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_number, member_id)
);

-- 세션 정보 테이블 (휴강일 등 관리)
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    session_number INTEGER UNIQUE NOT NULL,
    session_date DATE,
    is_holiday BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_attendance_session ON attendance_records(session_number);
CREATE INDEX idx_attendance_member ON attendance_records(member_id);
CREATE INDEX idx_members_instrument ON members(instrument);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능하도록 설정 (공개 앱의 경우)
CREATE POLICY "Enable all operations for all users" ON members FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON attendance_records FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON sessions FOR ALL USING (true);

-- 업데이트 시간 자동 갱신을 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
