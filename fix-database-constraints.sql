-- attendance_records 테이블 구조 확인 및 제약조건 수정

-- 1. 현재 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
ORDER BY ordinal_position;

-- 2. 현재 제약조건 확인
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'attendance_records'::regclass;

-- 3. 기존 제약조건 삭제 (필요한 경우)
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_pkey;
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_member_id_fkey;

-- 4. 올바른 제약조건 설정
-- Primary Key 설정 (id, session_number 조합)
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_pkey 
PRIMARY KEY (id, session_number);

-- Foreign Key 설정 (members 테이블의 id 참조)
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_id_fkey 
FOREIGN KEY (id) REFERENCES members(id) 
ON DELETE CASCADE;

-- 5. RLS 정책 설정
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON attendance_records;

-- 새로운 정책 생성
CREATE POLICY "Enable all operations for authenticated users" ON attendance_records
FOR ALL USING (true) WITH CHECK (true);

-- 6. 테이블 구조 최종 확인
\d attendance_records;
