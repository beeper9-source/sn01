# 데이터베이스 테이블 생성 가이드

## 📋 개요
수내체임버앙상블 출석부 프로그램에 필요한 데이터베이스 테이블을 생성하는 가이드입니다.

## 🗂️ 생성되는 테이블

### 1. `members` 테이블
- **용도**: 앙상블 멤버 정보 저장
- **컬럼**:
  - `id`: 자동 증가 기본키
  - `no`: 멤버 번호 (고유)
  - `name`: 멤버 이름
  - `instrument`: 악기 종류
  - `created_at`, `updated_at`: 생성/수정 시간

### 2. `attendance_records` 테이블
- **용도**: 출석 기록 저장
- **컬럼**:
  - `id`: 자동 증가 기본키
  - `session_number`: 회차 번호
  - `member_id`: 멤버 ID (외래키)
  - `status`: 출석 상태 (present/absent/pending/holiday)
  - `created_at`, `updated_at`: 생성/수정 시간

### 3. `sessions` 테이블 (선택사항)
- **용도**: 회차별 세션 정보 관리
- **컬럼**:
  - `id`: 자동 증가 기본키
  - `session_number`: 회차 번호
  - `session_date`: 수업 날짜
  - `is_holiday`: 휴강 여부
  - `notes`: 비고

## 🚀 테이블 생성 방법

### 방법 1: 완전한 설정 (권장)
1. Supabase 대시보드 → SQL Editor
2. `create-tables.sql` 파일 내용 복사
3. 붙여넣기 후 "Run" 실행

### 방법 2: 간단한 설정
1. Supabase 대시보드 → SQL Editor
2. `simple-create-tables.sql` 파일 내용 복사
3. 붙여넣기 후 "Run" 실행

## ✅ 생성 확인

### 1. 테이블 생성 확인
1. Supabase 대시보드 → Table Editor
2. 다음 테이블들이 생성되었는지 확인:
   - `members`
   - `attendance_records`
   - `sessions` (완전한 설정의 경우)

### 2. 데이터 확인
1. `members` 테이블 클릭
2. 18명의 멤버 데이터가 삽입되었는지 확인
3. 악기별로 올바르게 분류되었는지 확인

### 3. SQL로 확인
1. SQL Editor에서 `check-tables.sql` 실행
2. 모든 쿼리가 정상적으로 실행되는지 확인

## 📊 기본 데이터

### 멤버 데이터 (18명)
- **피아노**: 김희선 (1명)
- **바이올린**: 김호식, 목진혜, 성지윤, 나무홍 (4명)
- **첼로**: 조유진, 김진희, 이령, 이정헌, 김구 (5명)
- **클라리넷**: 노동일, 조원양, 신세연, 이상규, 이인섭 (5명)
- **플룻**: 김병민, 허진희, 민휘 (3명)

### 세션 데이터 (12회차)
- 1-4회차: 정상 수업
- 5회차: 휴강
- 6-12회차: 정상 수업 (6회차부터는 실제로는 5-11회차)

## 🔧 문제 해결

### 오류: "relation already exists"
- 테이블이 이미 존재하는 경우
- `DROP TABLE` 명령으로 기존 테이블 삭제 후 재생성

### 오류: "permission denied"
- RLS 정책 문제
- `simple-create-tables.sql` 사용 (RLS 비활성화)

### 오류: "duplicate key value"
- 멤버 데이터가 이미 존재하는 경우
- `ON CONFLICT DO NOTHING` 구문으로 해결됨

## 🎯 다음 단계

테이블 생성 완료 후:
1. `supabase-config.js` 파일에서 API 키 설정
2. `test-supabase.html` 또는 `simple-test.html`로 연결 테스트
3. 메인 출석부 앱에서 Supabase 연동 확인

## 📝 참고사항

- **완전한 설정**: 모든 기능과 보안 정책 포함
- **간단한 설정**: 최소한의 테이블만 생성 (빠른 테스트용)
- **RLS**: Row Level Security (행 수준 보안)
- **인덱스**: 쿼리 성능 최적화를 위한 인덱스 자동 생성
