-- attendance_records 테이블에 확장된 목업 데이터 삽입
-- 다양한 회차와 출석 상태를 포함한 10개 데이터

-- 1. 기존 목업 데이터 삭제 (선택사항)
-- DELETE FROM attendance_records WHERE id > 0;

-- 2. 확장된 목업 데이터 삽입 (10개)
INSERT INTO attendance_records (session_number, member_id, status) VALUES
-- 1회차 (9/7) - 3명
(1, (SELECT id FROM members WHERE no = 2), 'present'),   -- 김희선(피아노) - 출석
(1, (SELECT id FROM members WHERE no = 3), 'present'),   -- 김호식(바이올린) - 출석
(1, (SELECT id FROM members WHERE no = 7), 'absent'),    -- 조유진(첼로) - 결석

-- 2회차 (9/14) - 3명
(2, (SELECT id FROM members WHERE no = 4), 'present'),   -- 목진혜(바이올린) - 출석
(2, (SELECT id FROM members WHERE no = 8), 'pending'),   -- 김진희(첼로) - 미정
(2, (SELECT id FROM members WHERE no = 12), 'present'),  -- 노동일(클라리넷) - 출석

-- 3회차 (9/21) - 2명
(3, (SELECT id FROM members WHERE no = 5), 'absent'),    -- 성지윤(바이올린) - 결석
(3, (SELECT id FROM members WHERE no = 13), 'present'),  -- 조원양(클라리넷) - 출석

-- 4회차 (9/28) - 2명
(4, (SELECT id FROM members WHERE no = 6), 'present'),   -- 나무홍(바이올린) - 출석
(4, (SELECT id FROM members WHERE no = 17), 'pending');  -- 김병민(플룻) - 미정

-- 3. 삽입된 데이터 상세 조회
SELECT 
    ar.id,
    ar.session_number,
    CASE 
        WHEN ar.session_number = 1 THEN '1회차 (9/7)'
        WHEN ar.session_number = 2 THEN '2회차 (9/14)'
        WHEN ar.session_number = 3 THEN '3회차 (9/21)'
        WHEN ar.session_number = 4 THEN '4회차 (9/28)'
        ELSE CONCAT(ar.session_number, '회차')
    END as session_info,
    m.name,
    m.instrument,
    CASE 
        WHEN ar.status = 'present' THEN '출석'
        WHEN ar.status = 'absent' THEN '결석'
        WHEN ar.status = 'pending' THEN '미정'
        WHEN ar.status = 'holiday' THEN '휴강'
        ELSE ar.status
    END as status_korean,
    ar.created_at
FROM attendance_records ar
JOIN members m ON ar.member_id = m.id
ORDER BY ar.session_number, m.instrument, m.name;

-- 4. 회차별 출석 현황 요약
SELECT 
    ar.session_number,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count,
    COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count,
    COUNT(CASE WHEN ar.status = 'pending' THEN 1 END) as pending_count
FROM attendance_records ar
GROUP BY ar.session_number
ORDER BY ar.session_number;

-- 5. 악기별 출석 현황 요약
SELECT 
    m.instrument,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count,
    COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count,
    COUNT(CASE WHEN ar.status = 'pending' THEN 1 END) as pending_count
FROM attendance_records ar
JOIN members m ON ar.member_id = m.id
GROUP BY m.instrument
ORDER BY m.instrument;
