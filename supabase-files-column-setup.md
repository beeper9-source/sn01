# Supabase sheet_music 테이블에 files 컬럼 추가하기

## 문제
현재 `sheet_music` 테이블에 `files` 컬럼이 없어서 첨부파일 정보를 저장할 수 없습니다.

## 해결 방법

### 1. Supabase 대시보드에서 SQL 에디터 열기
1. Supabase 프로젝트 대시보드에 로그인
2. 왼쪽 메뉴에서 "SQL Editor" 클릭
3. "New query" 버튼 클릭

### 2. 다음 SQL 명령어 실행

```sql
-- sheet_music 테이블에 files 컬럼 추가
ALTER TABLE public.sheet_music 
ADD COLUMN files jsonb DEFAULT '[]'::jsonb;

-- 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN public.sheet_music.files IS '첨부파일 정보를 JSON 배열로 저장 (파일명, 크기, 타입, 경로 등)';

-- 기존 데이터의 files 컬럼을 빈 배열로 초기화
UPDATE public.sheet_music SET files = '[]'::jsonb WHERE files IS NULL;
```

### 3. 실행 확인
- SQL 에디터에서 "Run" 버튼 클릭
- 성공 메시지가 표시되면 완료

### 4. 테이블 구조 확인
다음 쿼리로 테이블 구조를 확인할 수 있습니다:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sheet_music'
ORDER BY ordinal_position;
```

## files 컬럼 데이터 구조
`files` 컬럼은 다음과 같은 JSON 배열 형태로 저장됩니다:

```json
[
  {
    "id": "1737481234567_abc123",
    "name": "악보.pdf",
    "safeName": "uC560uBCF4.pdf",
    "size": 1024000,
    "type": "application/pdf",
    "path": "1/1737481234567_abc123_uC560uBCF4.pdf",
    "uploaded_at": "2024-01-15T10:30:00.000Z"
  }
]
```

## 주의사항
- `files` 컬럼은 JSONB 타입으로 저장되어 효율적인 쿼리가 가능합니다
- 기존 데이터는 자동으로 빈 배열 `[]`로 초기화됩니다
- 파일 업로드/다운로드 시 이 컬럼의 데이터를 참조합니다
