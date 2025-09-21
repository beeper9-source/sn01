# Supabase 악보관리 연동 설정 가이드

## 1. Supabase 프로젝트 설정

### 1.1 테이블 생성
Supabase 대시보드의 SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- 악보 관리 테이블 생성
CREATE TABLE IF NOT EXISTS sheet_music (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    composer VARCHAR(255),
    arranger VARCHAR(255),
    genre VARCHAR(50),
    difficulty VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 활성화
ALTER TABLE sheet_music ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능하도록 정책 설정
CREATE POLICY "Enable all operations for all users" ON sheet_music
    FOR ALL USING (true);

-- updated_at 자동 업데이트를 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
CREATE TRIGGER update_sheet_music_updated_at 
    BEFORE UPDATE ON sheet_music 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 기본 악보 데이터 삽입
INSERT INTO sheet_music (title, composer, arranger, genre, difficulty, notes) VALUES
('Canon in D', 'Pachelbel', '', '클래식', '중급', '체임버앙상블 기본 레퍼토리'),
('Four Seasons - Spring', 'Vivaldi', '', '클래식', '고급', '바이올린 솔로 포함'),
('Yesterday', 'Paul McCartney', 'John Lennon', '팝', '초급', '비틀즈 명곡')
ON CONFLICT DO NOTHING;
```

### 1.2 RLS 정책 확인
- `sheet_music` 테이블의 RLS가 활성화되어 있는지 확인
- 모든 사용자가 읽기/쓰기 가능한 정책이 설정되어 있는지 확인

## 2. 기능 설명

### 2.1 악보 데이터 동기화
- **로컬 우선**: 악보 데이터는 먼저 로컬 스토리지에 저장됩니다
- **클라우드 동기화**: Supabase 연결 시 자동으로 클라우드와 동기화됩니다
- **실시간 업데이트**: 악보 추가/수정/삭제 시 즉시 Supabase에 반영됩니다

### 2.2 악보 정보 필드
- **제목** (필수): 악보의 제목
- **작곡가**: 원작곡가 이름
- **편곡가**: 편곡자 이름
- **장르**: 클래식, 팝, 재즈, 영화음악, 뮤지컬, 기타
- **난이도**: 초급, 중급, 고급
- **메모**: 추가 정보나 연주 노트

### 2.3 검색 기능
- 제목, 작곡가, 편곡가, 장르로 실시간 검색 가능
- 대소문자 구분 없이 부분 일치 검색

## 3. 사용 방법

### 3.1 악보 추가
1. "악보 관리" 버튼 클릭
2. "악보 추가" 버튼 클릭
3. 악보 정보 입력 후 "저장" 클릭
4. 자동으로 로컬 및 Supabase에 저장됩니다

### 3.2 악보 수정
1. 악보 목록에서 "수정" 버튼 클릭
2. 정보 수정 후 "저장" 클릭
3. 변경사항이 즉시 동기화됩니다

### 3.3 악보 삭제
1. 악보 목록에서 "삭제" 버튼 클릭
2. 확인 후 삭제
3. 로컬 및 Supabase에서 모두 삭제됩니다

### 3.4 악보 검색
1. 악보관리 모달 상단의 검색창에 키워드 입력
2. 실시간으로 필터링된 결과 표시

## 4. 오프라인 지원

- 인터넷 연결이 없어도 악보 관리 기능 사용 가능
- 로컬 스토리지에 데이터 저장
- 온라인 상태가 되면 자동으로 Supabase와 동기화

## 5. 문제 해결

### 5.1 동기화 오류
- 브라우저 개발자 도구의 콘솔에서 오류 메시지 확인
- Supabase 연결 상태 확인
- RLS 정책 설정 확인

### 5.2 데이터 손실 방지
- 정기적으로 Supabase에서 데이터 백업
- 로컬 스토리지 데이터는 브라우저 설정에 따라 보존됨

## 6. 보안 고려사항

- 현재는 모든 사용자가 모든 악보에 접근 가능
- 필요시 RLS 정책을 더 세밀하게 설정 가능
- 사용자 인증 시스템과 연동 시 권한 기반 접근 제어 가능
