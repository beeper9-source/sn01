-- 불필요한 데이터 삭제

-- 1. id=26인 출석 기록 삭제
DELETE FROM attendance_records WHERE id = 26;

-- 2. 삭제 후 확인
SELECT COUNT(*) as remaining_records FROM attendance_records;

-- 3. 현재 남아있는 출석 기록 확인
SELECT DISTINCT id FROM attendance_records ORDER BY id;



