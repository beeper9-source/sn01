-- 0. members 테이블에 휴회 설정을 위한 is_active 컬럼 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 1. seasons (시즌) 테이블 생성
CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS 정책 활성화 및 모든 사용자가 읽기/쓰기 가능하도록 정책 설정
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for all users on seasons" ON seasons;
CREATE POLICY "Enable all operations for all users on seasons" ON seasons FOR ALL USING (true);

-- 3. 기본 시즌 삽입 (26년 여름강의)
INSERT INTO seasons (name, start_date, end_date, is_active)
VALUES ('26년 여름강의', '2026-06-07', '2026-08-23', TRUE)
ON CONFLICT (name) DO NOTHING;


-- 4. sessions (회차) 테이블 조건부 생성 및 변경
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sessions') THEN
        -- 테이블이 존재하지 않으면 신규 생성
        CREATE TABLE sessions (
            id SERIAL PRIMARY KEY,
            season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
            session_number INTEGER NOT NULL,
            session_date DATE,
            is_holiday BOOLEAN DEFAULT FALSE,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE (season_id, session_number)
        );
        
        -- RLS 및 정책 설정
        ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
        EXECUTE 'CREATE POLICY "Enable all operations for all users" ON sessions FOR ALL USING (true)';
    ELSE
        -- 테이블이 존재하면 season_id 컬럼 조건부 추가
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='sessions' AND column_name='season_id') THEN
            ALTER TABLE sessions ADD COLUMN season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE;
            
            -- 기존 세션 데이터를 기본 시즌(26년 여름강의)에 연결
            UPDATE sessions 
            SET season_id = (SELECT id FROM seasons WHERE name = '26년 여름강의' LIMIT 1)
            WHERE season_id IS NULL;
            
            ALTER TABLE sessions ALTER COLUMN season_id SET NOT NULL;
        END IF;

        -- 기존 UNIQUE 제약 조건 제거 및 복합 UNIQUE 제약 조건 추가
        ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_number_key;
        ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_season_id_session_number_key;
        ALTER TABLE sessions ADD CONSTRAINT sessions_season_id_session_number_key UNIQUE (season_id, session_number);
    END IF;
END $$;

-- sessions 테이블에 기본 12회차 데이터 삽입 (비어있는 경우)
INSERT INTO sessions (season_id, session_number, session_date, is_holiday, notes)
SELECT 
    (SELECT id FROM seasons WHERE name = '26년 여름강의' LIMIT 1),
    g.num,
    ('2026-06-07'::DATE + (g.num - 1) * 7),
    FALSE,
    CASE WHEN g.num = 12 THEN '종강' ELSE '' END
FROM generate_series(1, 12) AS g(num)
ON CONFLICT (season_id, session_number) DO NOTHING;


-- 5. attendance_records (출석 기록) 테이블 변경
DO $$
BEGIN
    -- session_id 컬럼 추가 (null 허용으로 우선 생성)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='attendance_records' AND column_name='session_id') THEN
        ALTER TABLE attendance_records ADD COLUMN session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE;
        
        -- 기존 출석 데이터를 session_id로 갱신 (session_number와 일치하는 기본 시즌의 session_id 매핑)
        UPDATE attendance_records ar
        SET session_id = s.id
        FROM sessions s
        WHERE ar.session_number = s.session_number 
          AND s.season_id = (SELECT id FROM seasons WHERE name = '26년 여름강의' LIMIT 1)
          AND ar.session_id IS NULL;
          
        -- 매핑되지 않은 레코드 삭제
        DELETE FROM attendance_records WHERE session_id IS NULL;
        
        ALTER TABLE attendance_records ALTER COLUMN session_id SET NOT NULL;
    END IF;

    -- 기존 UNIQUE 제약 조건 제거 및 신규 복합 UNIQUE 제약 조건 추가
    ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_session_number_member_id_key;
    ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_session_id_member_id_key;
    ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_session_id_member_id_key UNIQUE (session_id, member_id);

    -- 기존 session_number 컬럼 삭제
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='attendance_records' AND column_name='session_number') THEN
        ALTER TABLE attendance_records DROP COLUMN session_number;
    END IF;
END $$;

-- 인덱스 변경
DROP INDEX IF EXISTS idx_attendance_session;
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance_records(session_id);


-- 6. session_practice_songs (차수별 연습곡 할당) 테이블 조건부 생성 및 변경
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session_practice_songs') THEN
        -- practice_songs 테이블이 있을 경우에만 생성
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'practice_songs') THEN
            CREATE TABLE session_practice_songs (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                practice_song_id INTEGER NOT NULL REFERENCES practice_songs(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(session_id, practice_song_id)
            );
            
            -- RLS 및 정책 설정
            ALTER TABLE session_practice_songs ENABLE ROW LEVEL SECURITY;
            EXECUTE 'CREATE POLICY "Session practice songs are viewable by everyone" ON session_practice_songs FOR SELECT USING (true)';
            EXECUTE 'CREATE POLICY "Session practice songs are insertable by authenticated users" ON session_practice_songs FOR INSERT WITH CHECK (true)';
            EXECUTE 'CREATE POLICY "Session practice songs are updatable by authenticated users" ON session_practice_songs FOR UPDATE USING (true)';
            EXECUTE 'CREATE POLICY "Session practice songs are deletable by authenticated users" ON session_practice_songs FOR DELETE USING (true)';
        END IF;
    ELSE
        -- 테이블이 존재하면 변경 처리
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='session_practice_songs' AND column_name='session_id') THEN
            ALTER TABLE session_practice_songs ADD COLUMN session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE;
            
            -- 기존 연습곡 할당 데이터를 session_id로 갱신
            UPDATE session_practice_songs sps
            SET session_id = s.id
            FROM sessions s
            WHERE sps.session_number = s.session_number 
              AND s.season_id = (SELECT id FROM seasons WHERE name = '26년 여름강의' LIMIT 1)
              AND sps.session_id IS NULL;
              
            DELETE FROM session_practice_songs WHERE session_id IS NULL;
            ALTER TABLE session_practice_songs ALTER COLUMN session_id SET NOT NULL;
        END IF;

        -- 제약 조건 변경
        ALTER TABLE session_practice_songs DROP CONSTRAINT IF EXISTS session_practice_songs_session_number_practice_song_id_key;
        ALTER TABLE session_practice_songs DROP CONSTRAINT IF EXISTS session_practice_songs_session_id_practice_song_id_key;
        ALTER TABLE session_practice_songs ADD CONSTRAINT session_practice_songs_session_id_practice_song_id_key UNIQUE (session_id, practice_song_id);

        -- 기존 session_number 컬럼 삭제
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name='session_practice_songs' AND column_name='session_number') THEN
            ALTER TABLE session_practice_songs DROP COLUMN session_number;
        END IF;
    END IF;
END $$;

-- 인덱스 변경
DROP INDEX IF EXISTS idx_session_practice_songs_session;
CREATE INDEX IF NOT EXISTS idx_session_practice_songs_session_id ON session_practice_songs(session_id);


-- 7. 업데이트 시간 자동 갱신 트리거 설정
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_seasons_updated_at ON seasons;
CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sessions') THEN
        DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
        CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
