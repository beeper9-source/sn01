-- sheet_music 테이블에 files 컬럼 추가
-- 첨부파일 정보를 JSON 형태로 저장

ALTER TABLE public.sheet_music 
ADD COLUMN files jsonb DEFAULT '[]'::jsonb;

-- 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN public.sheet_music.files IS '첨부파일 정보를 JSON 배열로 저장 (파일명, 크기, 타입, 경로 등)';

-- 기존 데이터의 files 컬럼을 빈 배열로 초기화
UPDATE public.sheet_music SET files = '[]'::jsonb WHERE files IS NULL;
