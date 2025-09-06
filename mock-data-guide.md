# 목업 데이터 삽입 가이드

## 📋 개요
`attendance_records` 테이블에 테스트용 목업 데이터를 삽입하는 가이드입니다.

## 🗂️ 제공되는 스크립트

### 1. `insert-mock-data.sql` - 기본 목업 데이터
- **데이터 수**: 10개
- **회차**: 1회차, 2회차
- **출석 상태**: present, absent, pending
- **멤버**: 5명 (다양한 악기)

### 2. `insert-mock-data-extended.sql` - 확장 목업 데이터
- **데이터 수**: 10개
- **회차**: 1회차, 2회차, 3회차, 4회차
- **출석 상태**: present, absent, pending
- **멤버**: 10명 (모든 악기 포함)
- **추가 기능**: 상세 조회 및 요약 통계

## 🚀 사용 방법

### 1단계: 기본 목업 데이터 삽입
1. Supabase 대시보드 → SQL Editor
2. `insert-mock-data.sql` 내용 복사
3. 붙여넣기 후 "Run" 실행

### 2단계: 확장 목업 데이터 삽입 (선택사항)
1. SQL Editor에서 `insert-mock-data-extended.sql` 실행
2. 더 다양한 데이터와 통계 확인

## 📊 삽입되는 목업 데이터

### 기본 버전 (10개)
```
1회차:
- 김희선(피아노) - 출석
- 김호식(바이올린) - 출석  
- 목진혜(바이올린) - 결석
- 조유진(첼로) - 출석
- 노동일(클라리넷) - 미정

2회차:
- 김희선(피아노) - 출석
- 성지윤(바이올린) - 결석
- 김진희(첼로) - 출석
- 조원양(클라리넷) - 출석
- 김병민(플룻) - 미정
```

### 확장 버전 (10개)
```
1회차: 김희선(출석), 김호식(출석), 조유진(결석)
2회차: 목진혜(출석), 김진희(미정), 노동일(출석)
3회차: 성지윤(결석), 조원양(출석)
4회차: 나무홍(출석), 김병민(미정)
```

## ✅ 데이터 확인

### 1. Table Editor에서 확인
1. Supabase 대시보드 → Table Editor
2. `attendance_records` 테이블 클릭
3. 삽입된 데이터 확인

### 2. SQL로 확인
```sql
-- 모든 출석 기록 조회
SELECT 
    ar.session_number,
    m.name,
    m.instrument,
    ar.status
FROM attendance_records ar
JOIN members m ON ar.member_id = m.id
ORDER BY ar.session_number, m.name;
```

## 🔧 문제 해결

### 오류: "member_id does not exist"
- `members` 테이블에 데이터가 없는 경우
- 먼저 `create-tables.sql` 실행 필요

### 오류: "duplicate key value"
- 동일한 session_number와 member_id 조합이 이미 존재
- 기존 데이터 삭제 후 재실행:
```sql
DELETE FROM attendance_records WHERE id > 0;
```

### 오류: "violates check constraint"
- status 값이 올바르지 않음
- 허용되는 값: 'present', 'absent', 'pending', 'holiday'

## 🎯 다음 단계

목업 데이터 삽입 완료 후:
1. 출석부 앱에서 데이터 조회 테스트
2. 출석 상태 변경 기능 테스트
3. 실시간 동기화 기능 테스트

## 📝 참고사항

- **목업 데이터**: 실제 사용 데이터가 아닌 테스트용 데이터
- **멤버 참조**: `members` 테이블의 `id`를 외래키로 사용
- **회차 번호**: 1-12회차 (5회차는 휴강)
- **출석 상태**: present(출석), absent(결석), pending(미정), holiday(휴강)

