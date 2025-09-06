-- 중복 출석 기록 데이터 정리 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. 중복 데이터 확인
SELECT 
    session_number,
    member_id,
    COUNT(*) as duplicate_count
FROM attendance_records 
GROUP BY session_number, member_id 
HAVING COUNT(*) > 1
ORDER BY session_number, member_id;

-- 2. 중복 데이터 삭제 (가장 최근 것만 남기기)
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY session_number, member_id 
            ORDER BY created_at DESC
        ) as rn
    FROM attendance_records
)
DELETE FROM attendance_records 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- 3. 정리 후 데이터 확인
SELECT 
    session_number,
    member_id,
    status,
    created_at
FROM attendance_records 
ORDER BY session_number, member_id;

-- 4. 고유 제약 조건 확인
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'attendance_records'::regclass 
AND contype = 'u';
