# GitHub Gist 설정 가이드

여러 모바일 기기에서 출석부를 동기화하기 위해 GitHub Gist를 사용합니다.

## 1. GitHub Personal Access Token 생성

1. [GitHub](https://github.com)에 로그인
2. 우측 상단 프로필 → **Settings** 클릭
3. 좌측 메뉴에서 **Developer settings** 클릭
4. **Personal access tokens** → **Tokens (classic)** 클릭
5. **Generate new token** → **Generate new token (classic)** 클릭
6. 설정:
   - **Note**: "출석부 동기화"
   - **Expiration**: "No expiration" (또는 원하는 기간)
   - **Scopes**: `gist` 체크
7. **Generate token** 클릭
8. 생성된 토큰을 복사하여 저장 (다시 볼 수 없음)

## 2. Gist 생성

1. [GitHub Gist](https://gist.github.com) 접속
2. **Create a new gist** 클릭
3. 설정:
   - **Filename**: `attendance.json`
   - **Content**: `{}`
   - **Create public gist** 또는 **Create secret gist** 선택
4. **Create public gist** 클릭
5. 생성된 Gist URL에서 ID 복사
   - 예: `https://gist.github.com/username/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
   - ID: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

## 3. 설정 파일 수정

`script.js` 파일에서 다음 부분을 수정:

```javascript
// GitHub Gist를 사용한 클라우드 동기화
this.gistId = '여기에_복사한_Gist_ID_입력';
this.githubToken = '여기에_생성한_Token_입력';
```

## 4. 보안 주의사항

- **Public Gist**: 누구나 볼 수 있지만 편집은 토큰이 있어야 함
- **Secret Gist**: 토큰이 있는 사람만 볼 수 있음
- **토큰 보안**: 토큰을 공개하지 마세요
- **토큰 권한**: gist 권한만 부여하여 보안 강화

## 5. 사용 방법

1. 설정 완료 후 앱 사용
2. 한 기기에서 출석 체크 후 "저장 및 동기화" 클릭
3. 다른 기기에서 15초 이내에 자동 동기화 확인
4. 우측 상단에서 마지막 동기화 시간 확인

## 6. 문제 해결

### 동기화가 안될 때
1. GitHub 토큰이 올바른지 확인
2. Gist ID가 정확한지 확인
3. 인터넷 연결 상태 확인
4. 브라우저 개발자 도구 콘솔에서 에러 메시지 확인

### 권한 오류
- 토큰에 `gist` 권한이 있는지 확인
- Gist가 삭제되지 않았는지 확인

### 네트워크 오류
- GitHub API 접근이 가능한지 확인
- 방화벽이나 프록시 설정 확인
