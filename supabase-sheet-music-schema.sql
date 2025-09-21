-- 악보 관리 테이블 생성
CREATE TABLE IF NOT EXISTS sheet_music (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    composer VARCHAR(255),
    arranger VARCHAR(255),
    genre VARCHAR(50),
    difficulty VARCHAR(20),
    notes TEXT,
    files JSONB DEFAULT '[]'::jsonb,
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
