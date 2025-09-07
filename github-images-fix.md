# GitHub Pages 이미지 로드 문제 해결 방법

## 문제
GitHub Pages에서 이미지 파일이 로드되지 않는 경우가 있습니다.

## 해결 방법

### 1. 파일명 소문자 변경 ✅
- `sn_concert.JPG` → `sn_concert.jpg` (완료)
- GitHub는 대소문자를 구분하므로 소문자 사용 권장

### 2. GitHub Pages 설정 확인
1. Repository Settings → Pages
2. Source를 "Deploy from a branch"로 설정
3. Branch를 "main" 또는 "master"로 설정

### 3. 이미지 파일 경로 확인
- 모든 이미지 파일이 repository root에 있는지 확인
- `logo.png`, `sn_concert.jpg` 파일이 올바른 위치에 있는지 확인

### 4. 브라우저 캐시 클리어
- GitHub Pages URL에서 Ctrl+F5로 강제 새로고침
- 또는 시크릿 모드에서 테스트

### 5. 대체 방법 (필요시)
만약 여전히 이미지가 로드되지 않으면:

#### 방법 A: CDN 사용
```css
.header {
    background: url('https://via.placeholder.com/800x400/667eea/ffffff?text=Concert+Background');
}
```

#### 방법 B: Base64 인코딩
이미지를 Base64로 인코딩하여 CSS에 직접 포함

#### 방법 C: 다른 이미지 호스팅 서비스 사용
- Imgur, Cloudinary 등 사용

## 현재 적용된 해결책
1. ✅ 파일명 소문자 변경
2. ✅ 대체 배경 그라데이션 추가
3. ✅ background-blend-mode로 이미지와 그라데이션 조합
4. ✅ 로고 중앙 정렬

## 테스트 방법
1. 로컬에서 `index.html` 열기
2. GitHub Pages URL에서 확인
3. 개발자 도구에서 네트워크 탭 확인하여 이미지 로드 상태 점검



