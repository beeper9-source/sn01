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

