-- 출석 기록 전체 삭제 (26년 여름학기 시작 전 초기화)
-- Supabase SQL Editor에서 실행하세요.

DELETE FROM attendance_records;

SELECT COUNT(*) AS remaining_records FROM attendance_records;
