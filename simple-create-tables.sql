-- 간단한 테이블 생성 스크립트 (최소한의 설정)
-- Supabase SQL Editor에서 실행하세요

-- 1. 멤버 테이블
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    no INTEGER UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    instrument VARCHAR(20) NOT NULL
);

-- 2. 출석 기록 테이블
CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    session_number INTEGER NOT NULL,
    member_id INTEGER REFERENCES members(id),
    status VARCHAR(10) NOT NULL,
    UNIQUE(session_number, member_id)
);

-- 3. RLS 비활성화 (간단한 설정)
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records DISABLE ROW LEVEL SECURITY;

-- 4. 멤버 데이터 삽입
INSERT INTO members (no, name, instrument) VALUES
(2, '김희선', '피아노'),
(3, '김호식', '바이올린'),
(4, '목진혜', '바이올린'),
(5, '성지윤', '바이올린'),
(6, '나무홍', '바이올린'),
(7, '조유진', '첼로'),
(8, '김진희', '첼로'),
(9, '이령', '첼로'),
(10, '이정헌', '첼로'),
(11, '김구', '첼로'),
(12, '노동일', '클라리넷'),
(13, '조원양', '클라리넷'),
(14, '신세연', '클라리넷'),
(15, '이상규', '클라리넷'),
(16, '이인섭', '클라리넷'),
(17, '김병민', '플룻'),
(18, '허진희', '플룻'),
(19, '민휘', '플룻');

