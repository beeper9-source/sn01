-- 김호식을 김효식으로 이름 변경하는 SQL 쿼리
-- Supabase SQL Editor에서 실행하세요

-- 1. 변경 전 현재 상태 확인
SELECT id, no, name, instrument, updated_at 
FROM members 
WHERE name = '김호식';

-- 2. 이름 변경 실행
UPDATE members 
SET name = '김효식', updated_at = NOW()
WHERE name = '김호식';

-- 3. 변경 후 결과 확인
SELECT id, no, name, instrument, updated_at 
FROM members 
WHERE name = '김효식';

-- 4. 변경된 멤버의 출석 기록도 함께 확인
SELECT 
    ar.id,
    ar.session_number,
    m.name,
    m.instrument,
    ar.status,
    ar.created_at
FROM attendance_records ar
JOIN members m ON ar.member_id = m.id
WHERE m.name = '김효식'
ORDER BY ar.session_number;

