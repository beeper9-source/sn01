# Supabase Practice Songs 테이블 설정 가이드

## 1. Practice Songs 테이블 생성

Supabase SQL Editor에서 다음 SQL을 실행하여 practice_songs 테이블을 생성하세요:

```sql
-- Practice Songs 테이블 생성
CREATE TABLE IF NOT EXISTS practice_songs (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    composer TEXT,
    description TEXT,
    difficulty TEXT DEFAULT '보통',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session Practice Songs 테이블 생성 (차수별 연습곡 할당)
CREATE TABLE IF NOT EXISTS session_practice_songs (
    id SERIAL PRIMARY KEY,
    session_number INTEGER NOT NULL,
    practice_song_id INTEGER NOT NULL REFERENCES practice_songs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_number, practice_song_id)
);

-- RLS (Row Level Security) 활성화
ALTER TABLE practice_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_practice_songs ENABLE ROW LEVEL SECURITY;

-- Practice Songs 정책 설정
CREATE POLICY "Practice songs are viewable by everyone" ON practice_songs
    FOR SELECT USING (true);

CREATE POLICY "Practice songs are insertable by authenticated users" ON practice_songs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Practice songs are updatable by authenticated users" ON practice_songs
    FOR UPDATE USING (true);

CREATE POLICY "Practice songs are deletable by authenticated users" ON practice_songs
    FOR DELETE USING (true);

-- Session Practice Songs 정책 설정
CREATE POLICY "Session practice songs are viewable by everyone" ON session_practice_songs
    FOR SELECT USING (true);

CREATE POLICY "Session practice songs are insertable by authenticated users" ON session_practice_songs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Session practice songs are updatable by authenticated users" ON session_practice_songs
    FOR UPDATE USING (true);

CREATE POLICY "Session practice songs are deletable by authenticated users" ON session_practice_songs
    FOR DELETE USING (true);

-- updated_at 자동 업데이트를 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- practice_songs 테이블에 updated_at 트리거 적용
CREATE TRIGGER update_practice_songs_updated_at 
    BEFORE UPDATE ON practice_songs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_practice_songs_title ON practice_songs(title);
CREATE INDEX IF NOT EXISTS idx_practice_songs_composer ON practice_songs(composer);
CREATE INDEX IF NOT EXISTS idx_session_practice_songs_session ON session_practice_songs(session_number);
CREATE INDEX IF NOT EXISTS idx_session_practice_songs_song ON session_practice_songs(practice_song_id);
```

## 2. 테이블 구조 확인

생성된 테이블들의 구조는 다음과 같습니다:

### practice_songs 테이블
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | SERIAL PRIMARY KEY | 자동 증가 기본키 |
| title | TEXT NOT NULL | 곡명 |
| composer | TEXT | 작곡가 |
| description | TEXT | 설명 |
| difficulty | TEXT | 난이도 (기본값: '보통') |
| created_at | TIMESTAMP | 생성 시간 |
| updated_at | TIMESTAMP | 수정 시간 |

### session_practice_songs 테이블
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | SERIAL PRIMARY KEY | 자동 증가 기본키 |
| session_number | INTEGER NOT NULL | 회차 번호 |
| practice_song_id | INTEGER NOT NULL | 연습곡 ID (외래키) |
| created_at | TIMESTAMP | 생성 시간 |

## 3. 데이터 확인

다음 SQL로 생성된 데이터를 확인할 수 있습니다:

```sql
-- 모든 연습곡 조회
SELECT * FROM practice_songs ORDER BY created_at DESC;

-- 차수별 연습곡 할당 조회
SELECT 
    sps.session_number,
    ps.title,
    ps.composer,
    ps.difficulty
FROM session_practice_songs sps
JOIN practice_songs ps ON sps.practice_song_id = ps.id
ORDER BY sps.session_number, ps.title;
```

## 4. 자동 동기화

앱이 시작될 때 자동으로 Supabase와 동기화됩니다:

- 로컬 스토리지의 연습곡 데이터를 Supabase로 업로드
- Supabase의 최신 데이터를 로컬로 다운로드
- 차수별 할당 정보도 함께 동기화

## 5. 기능

- **연습곡 CRUD**: 추가, 수정, 삭제, 조회
- **차수별 할당**: 각 회차별로 연습곡 할당/해제
- **실시간 동기화**: 온라인 상태에서 자동 동기화
- **오프라인 지원**: 로컬 스토리지 백업

