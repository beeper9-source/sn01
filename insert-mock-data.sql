-- attendance_records 테이블에 목업 데이터 10개 삽입
-- Supabase SQL Editor에서 실행하세요

-- 1. 기존 목업 데이터 삭제 (선택사항)
-- DELETE FROM attendance_records WHERE id > 0;

-- 2. 목업 데이터 삽입
INSERT INTO attendance_records (session_number, member_id, status) VALUES
-- 1회차 출석 기록
(1, (SELECT id FROM members WHERE no = 2), 'present'),   -- 김희선(피아노) - 출석
(1, (SELECT id FROM members WHERE no = 3), 'present'),   -- 김호식(바이올린) - 출석
(1, (SELECT id FROM members WHERE no = 4), 'absent'),    -- 목진혜(바이올린) - 결석
(1, (SELECT id FROM members WHERE no = 7), 'present'),   -- 조유진(첼로) - 출석
(1, (SELECT id FROM members WHERE no = 12), 'pending'),  -- 노동일(클라리넷) - 미정

-- 2회차 출석 기록
(2, (SELECT id FROM members WHERE no = 2), 'present'),   -- 김희선(피아노) - 출석
(2, (SELECT id FROM members WHERE no = 5), 'absent'),    -- 성지윤(바이올린) - 결석
(2, (SELECT id FROM members WHERE no = 8), 'present'),   -- 김진희(첼로) - 출석
(2, (SELECT id FROM members WHERE no = 13), 'present'),  -- 조원양(클라리넷) - 출석
(2, (SELECT id FROM members WHERE no = 17), 'pending');  -- 김병민(플룻) - 미정

-- 3. 삽입된 데이터 확인
SELECT 
    ar.id,
    ar.session_number,
    m.name,
    m.instrument,
    ar.status,
    ar.created_at
FROM attendance_records ar
JOIN members m ON ar.member_id = m.id
ORDER BY ar.session_number, m.instrument, m.name;
