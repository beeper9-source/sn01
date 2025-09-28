-- Sessions 테이블 삭제
-- 주의: 이 명령어는 sessions 테이블과 관련된 모든 데이터를 영구적으로 삭제합니다.

-- 1. 트리거 삭제
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;

-- 2. 트리거 함수 삭제 (다른 테이블에서도 사용 중이면 삭제하지 마세요)
-- DROP FUNCTION IF EXISTS update_updated_at_column();

-- 3. RLS 정책 삭제
DROP POLICY IF EXISTS "Sessions are viewable by everyone" ON sessions;
DROP POLICY IF EXISTS "Sessions are insertable by authenticated users" ON sessions;
DROP POLICY IF EXISTS "Sessions are updatable by authenticated users" ON sessions;
DROP POLICY IF EXISTS "Sessions are deletable by authenticated users" ON sessions;

-- 4. 테이블 삭제
DROP TABLE IF EXISTS sessions;

-- 삭제 완료 확인
SELECT 'Sessions 테이블이 성공적으로 삭제되었습니다.' as result;

