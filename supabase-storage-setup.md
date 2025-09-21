# Supabase Storage 설정 가이드

## 1. Supabase Storage 버킷 생성

### 1.1 Storage 버킷 생성
Supabase 대시보드의 Storage 섹션에서 다음 버킷을 생성하세요:

**버킷 이름**: `sheet-music-files`
**공개 버킷**: Yes (공개적으로 접근 가능)
**파일 크기 제한**: 50MB
**허용된 MIME 타입**: 
- `application/pdf`
- `image/*`
- `audio/*`
- `audio/midi`
- `audio/mid`

### 1.2 RLS 정책 설정
Storage 버킷에 대해 다음 RLS 정책을 설정하세요:

```sql
-- 모든 사용자가 파일을 읽을 수 있도록 허용
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'sheet-music-files');

-- 모든 사용자가 파일을 업로드할 수 있도록 허용
CREATE POLICY "Public Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'sheet-music-files');

-- 모든 사용자가 파일을 업데이트할 수 있도록 허용
CREATE POLICY "Public Update" ON storage.objects
FOR UPDATE USING (bucket_id = 'sheet-music-files');

-- 모든 사용자가 파일을 삭제할 수 있도록 허용
CREATE POLICY "Public Delete" ON storage.objects
FOR DELETE USING (bucket_id = 'sheet-music-files');
```

## 2. 파일 구조

### 2.1 파일 경로 규칙
- **버킷**: `sheet-music-files`
- **경로**: `{sheet_id}/{file_id}_{filename}`
- **예시**: `1/1737481234567_abc123_canon.pdf`

### 2.2 파일 메타데이터
각 파일은 다음 정보를 포함합니다:
- `id`: 고유 파일 ID
- `name`: 원본 파일명
- `size`: 파일 크기 (바이트)
- `type`: MIME 타입
- `path`: Supabase Storage 경로
- `uploaded_at`: 업로드 시간

## 3. 보안 고려사항

### 3.1 현재 설정 (개발용)
- 모든 사용자가 모든 파일에 접근 가능
- 인증 없이 파일 업로드/다운로드 가능

### 3.2 프로덕션 권장사항
- 사용자 인증 시스템 도입
- 파일별 접근 권한 설정
- 파일 크기 및 타입 제한 강화
- 바이러스 스캔 기능 추가

## 4. 사용법

### 4.1 파일 업로드
```javascript
const { data, error } = await supabase.storage
  .from('sheet-music-files')
  .upload(`${sheetId}/${fileId}_${fileName}`, file);
```

### 4.2 파일 다운로드
```javascript
const { data } = await supabase.storage
  .from('sheet-music-files')
  .download(filePath);
```

### 4.3 파일 삭제
```javascript
const { error } = await supabase.storage
  .from('sheet-music-files')
  .remove([filePath]);
```

## 5. 문제 해결

### 5.1 일반적인 오류
- **403 Forbidden**: RLS 정책 확인
- **413 Payload Too Large**: 파일 크기 제한 확인
- **415 Unsupported Media Type**: MIME 타입 제한 확인

### 5.2 디버깅
- Supabase 대시보드의 Storage 섹션에서 파일 확인
- 브라우저 개발자 도구의 Network 탭에서 요청 확인
- Supabase 로그에서 오류 메시지 확인
