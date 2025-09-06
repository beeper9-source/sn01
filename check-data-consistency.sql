-- 데이터 일관성 확인 및 수정

-- 1. members 테이블의 모든 id 확인
SELECT id, name FROM members ORDER BY id;

-- 2. attendance_records 테이블의 모든 id 확인
SELECT DISTINCT id FROM attendance_records ORDER BY id;

-- 3. members 테이블에 없는 id가 attendance_records에 있는지 확인
SELECT DISTINCT ar.id 
FROM attendance_records ar 
LEFT JOIN members m ON ar.id = m.id 
WHERE m.id IS NULL;

-- 4. 문제가 있는 데이터 삭제 (members 테이블에 없는 id의 출석 기록)
DELETE FROM attendance_records 
WHERE id NOT IN (SELECT id FROM members);

-- 5. 삭제 후 데이터 확인
SELECT COUNT(*) as remaining_records FROM attendance_records;

-- 6. members 테이블에 샘플 데이터 추가 (필요한 경우)
-- INSERT INTO members (id, name, instrument) VALUES 
-- (1, '김철수', '바이올린'),
-- (2, '이영희', '첼로'),
-- (3, '박민수', '바이올린'),
-- (4, '정수진', '비올라'),
-- (5, '최지훈', '바이올린'),
-- (6, '한소영', '첼로'),
-- (7, '강동현', '바이올린'),
-- (8, '윤서연', '비올라'),
-- (9, '임태호', '첼로'),
-- (10, '조미래', '바이올린'),
-- (11, '신현우', '바이올린'),
-- (12, '오지은', '첼로'),
-- (13, '배성민', '비올라'),
-- (14, '송하늘', '바이올린'),
-- (15, '권지안', '첼로'),
-- (16, '홍길동', '바이올린'),
-- (17, '김영수', '비올라'),
-- (18, '이민정', '첼로'),
-- (19, '박준호', '바이올린'),
-- (20, '정유진', '비올라'),
-- (21, '최승현', '바이올린'),
-- (22, '한지원', '첼로'),
-- (23, '강민석', '바이올린'),
-- (24, '윤서현', '비올라'),
-- (25, '임도현', '첼로'),
-- (26, '조수빈', '바이올린');

-- 7. 최종 데이터 확인
SELECT 
    m.id, 
    m.name, 
    m.instrument,
    COUNT(ar.id) as attendance_count
FROM members m 
LEFT JOIN attendance_records ar ON m.id = ar.id 
GROUP BY m.id, m.name, m.instrument 
ORDER BY m.id;


