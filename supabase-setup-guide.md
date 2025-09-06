# Supabase 연동 설정 가이드

## 1. Supabase 프로젝트 생성

### 1.1 계정 생성
1. [https://supabase.com](https://supabase.com)에 접속
2. "Start your project" 클릭하여 계정 생성
3. GitHub, Google, 또는 이메일로 가입

### 1.2 새 프로젝트 생성
1. 대시보드에서 "New Project" 클릭
2. 프로젝트 정보 입력:
   - **Name**: `sn-attend-db` (또는 원하는 이름)
   - **Database Password**: 안전한 비밀번호 설정 (기록해두세요!)
   - **Region**: `Northeast Asia (Seoul)` 선택
3. "Create new project" 클릭
4. 프로젝트 생성 완료까지 2-3분 대기

## 2. 데이터베이스 스키마 설정

### 2.1 SQL 에디터에서 스키마 실행
1. Supabase 대시보드에서 좌측 메뉴 "SQL Editor" 클릭
2. "New query" 클릭
3. `supabase-schema.sql` 파일의 내용을 복사하여 붙여넣기
4. "Run" 버튼 클릭하여 실행

### 2.2 테이블 확인
1. 좌측 메뉴 "Table Editor" 클릭
2. 다음 테이블들이 생성되었는지 확인:
   - `members` (멤버 정보)
   - `attendance_records` (출석 기록)
   - `sessions` (세션 정보)

## 3. API 키 설정

### 3.1 API 키 확인
1. 좌측 메뉴 "Settings" → "API" 클릭
2. 다음 정보를 복사:
   - **Project URL** (예: `https://your-project-id.supabase.co`)
   - **anon public** key

### 3.2 설정 파일 업데이트
1. `supabase-config.js` 파일 열기
2. 다음 값들을 실제 값으로 교체:

```javascript
const SUPABASE_CONFIG = {
    // 실제 Project URL로 교체
    url: 'https://your-project-id.supabase.co',
    
    // 실제 anon public key로 교체
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

## 4. 테스트 및 검증

### 4.1 브라우저에서 테스트
1. 웹 브라우저에서 `index.html` 파일 열기
2. 개발자 도구 (F12) → Console 탭 열기
3. 다음 메시지 확인:
   - "Supabase 버전 사용" (성공)
   - "Supabase 설정이 완료되지 않았습니다" (설정 필요)

### 4.2 기능 테스트
1. 출석 상태 변경 테스트
2. "저장 및 동기화" 버튼 클릭
3. Supabase 대시보드에서 데이터 확인:
   - Table Editor → `attendance_records` 테이블에서 출석 기록 확인

## 5. 문제 해결

### 5.1 일반적인 오류

**"Supabase 설정이 완료되지 않았습니다"**
- `supabase-config.js` 파일의 URL과 API 키가 올바른지 확인

**"멤버 데이터 초기화 실패"**
- SQL 스키마가 올바르게 실행되었는지 확인
- RLS 정책이 올바르게 설정되었는지 확인

**"출석 기록 저장 실패"**
- 네트워크 연결 상태 확인
- Supabase 프로젝트가 활성 상태인지 확인

### 5.2 로그 확인
- 브라우저 개발자 도구 → Console에서 오류 메시지 확인
- Supabase 대시보드 → Logs에서 서버 로그 확인

## 6. 보안 고려사항

### 6.1 API 키 보안
- `anon public` 키는 클라이언트에 노출되어도 안전
- `service_role` 키는 절대 클라이언트에 노출하지 말 것

### 6.2 RLS (Row Level Security)
- 현재 모든 사용자가 읽기/쓰기 가능하도록 설정
- 필요시 더 엄격한 정책으로 변경 가능

## 7. 마이그레이션 완료

Supabase 연동이 완료되면:
1. 기존 JSONBin.io 데이터는 자동으로 Supabase로 이전됨
2. 모든 출석 기록이 Supabase 데이터베이스에 저장됨
3. 실시간 동기화 기능 사용 가능
4. 더 안정적이고 확장 가능한 데이터 저장소 사용

