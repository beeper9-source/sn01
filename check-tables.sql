-- 테이블 생성 확인 및 데이터 조회 스크립트
-- Supabase SQL Editor에서 실행하여 테이블이 올바르게 생성되었는지 확인하세요

-- 1. 생성된 테이블 목록 확인
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. 멤버 테이블 구조 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'members' 
ORDER BY ordinal_position;

-- 3. 출석 기록 테이블 구조 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
ORDER BY ordinal_position;

-- 4. 세션 테이블 구조 확인 (있는 경우)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'sessions' 
ORDER BY ordinal_position;

-- 5. 멤버 데이터 확인
SELECT * FROM members ORDER BY no;

-- 6. 멤버 수 확인
SELECT COUNT(*) as total_members FROM members;

-- 7. 악기별 멤버 수 확인
SELECT instrument, COUNT(*) as member_count 
FROM members 
GROUP BY instrument 
ORDER BY instrument;

-- 8. 출석 기록 확인 (있는 경우)
SELECT * FROM attendance_records ORDER BY session_number, member_id;

-- 9. 세션 정보 확인 (있는 경우)
SELECT * FROM sessions ORDER BY session_number;

-- 10. 인덱스 확인
SELECT indexname, tablename, indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

