# Category Mapping - 로그인 자동화 스크립트

Playwright를 사용한 더망고 관리자 페이지 로그인 자동화 스크립트입니다.

## 설치 방법

1. Node.js가 설치되어 있는지 확인하세요 (https://nodejs.org/)

2. 프로젝트 디렉토리에서 의존성 설치:
```bash
npm install
```

3. Playwright 브라우저 설치:
```bash
npx playwright install
```

## 사용 방법

### 스크립트 실행

```bash
npm run login
```

또는

```bash
node login.js
```

## 스크립트 동작

1. Chromium 브라우저를 실행합니다
2. 더망고 관리자 페이지로 이동합니다
3. 아이디(yjw0817)와 비밀번호를 자동으로 입력합니다
4. 로그인 버튼을 클릭합니다
5. 로그인 성공 후 스크린샷을 저장합니다 (`login_success.png`)

## 파일 구조

- `login.js` - 메인 로그인 스크립트
- `package.json` - 프로젝트 설정 및 의존성
- `README.md` - 사용 설명서

## 주의사항

- 스크립트는 `headless: false` 모드로 실행되어 브라우저 UI가 표시됩니다
- 백그라운드에서 실행하려면 `login.js`의 `headless: true`로 변경하세요
- 로그인 정보를 변경하려면 `login.js` 파일을 수정하세요
