# 11번가 카테고리 매핑 시스템 - 설정 가이드

## 📋 목차
1. [시스템 요구사항](#시스템-요구사항)
2. [초기 설정](#초기-설정)
3. [실행 방법](#실행-방법)
4. [문제 해결](#문제-해결)
5. [주요 기능](#주요-기능)

---

## 시스템 요구사항

### 필수 소프트웨어
- ✅ Node.js (v14 이상)
- ✅ Google Chrome 브라우저
- ✅ 더망고 솔루션 Chrome 확장 프로그램

### 필수 파일
- ✅ `.env` - 환경 변수 설정 파일
- ✅ `process-categories.js` - 메인 스크립트
- ✅ `start-chrome-debug.bat` - Chrome 디버깅 모드 실행 스크립트
- ✅ `package.json` - Node.js 패키지 설정

---

## 초기 설정

### 1. 프로젝트 설치

```bash
# 프로젝트 디렉토리로 이동
cd D:\Projects\CategoryMapping

# 의존성 설치
npm install
```

### 2. 환경 변수 설정 (.env)

`.env` 파일에 다음 정보를 설정하세요:

```env
# 로그인 정보
ID=your_id
PW=your_password

# 타겟 사이트
TARGET_SITES=https://tmg4696.mycafe24.com/mall/admin/admin.php

# 구글 시트 설정
CATEGORY_COLLECT_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
SHEET=11번가 아마존(섬김Trade)

# Chrome DevTools Protocol 설정
CDP_URL=http://127.0.0.1:9223

# Chrome 확장 프로그램 경로
CHROME_EXTENSION_PATH=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Extensions\\lgfjcapohoongednoojdaiedebgbcelp\\7.6.7_0
```

### 3. Chrome 확장 프로그램 확인

더망고 솔루션 확장 프로그램이 설치되어 있는지 확인:
1. Chrome에서 `chrome://extensions/` 접속
2. "더망고 솔루션" 확장 프로그램 확인
3. 확장 프로그램 ID와 버전 확인

---

## 실행 방법

### ✅ 체크리스트: 실행 전 확인사항

- [ ] 모든 Chrome 창이 닫혀있는가?
- [ ] `.env` 파일에 올바른 정보가 입력되어 있는가?
- [ ] 인터넷 연결이 정상인가?
- [ ] Google Sheets에 접근 권한이 있는가?

### Step 1: Chrome 디버깅 모드 실행

**방법 1: 배치 파일 사용 (권장)**
```cmd
# PowerShell 또는 CMD에서
.\start-chrome-debug.bat
```

**방법 2: 수동 실행**
```cmd
# 1. 모든 Chrome 창 닫기
taskkill /F /IM chrome.exe

# 2. Chrome 디버깅 모드로 실행
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9223 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data"
```

### Step 2: 연결 확인

**새 터미널 창에서 CDP 연결 테스트:**
```cmd
curl http://127.0.0.1:9223/json/version
```

**예상 결과:**
```json
{
   "Browser": "Chrome/...",
   "Protocol-Version": "1.3",
   "User-Agent": "...",
   "V8-Version": "...",
   "WebKit-Version": "...",
   "webSocketDebuggerUrl": "ws://127.0.0.1:9223/devtools/browser/..."
}
```

❌ **Connection refused 오류가 나오면:**
- Chrome이 제대로 실행되지 않은 것입니다
- Step 1부터 다시 시작하세요

### Step 3: 스크립트 실행

```cmd
cd D:\Projects\CategoryMapping
npm run process
```

### Step 4: 메뉴 선택

```
============================================================
🏪 11st Category Management System
============================================================
1. 사이트 대량상품수집
2. 카테고리 매핑
3. 닫기
============================================================
선택하세요 (1-3):
```

---

## 주요 기능

### 1. 사이트 대량상품수집

**실행 흐름:**
1. ✅ 자동 로그인 (ID/PW 사용)
2. ✅ getGoods.php 페이지로 이동
3. ✅ Google Sheets 열기 (새 탭)
4. ✅ 지정된 시트로 이동
5. ✅ D3 셀에서 URL 읽기
6. ✅ URL로 상품 검색

**처리 과정:**
```
로그인 → 상품수집 페이지 이동 → Google Sheets 열기
  → 시트 선택 → URL 읽기 → 검색 실행 → 완료
```

### 2. 카테고리 매핑

**실행 흐름:**
1. ✅ 자동 로그인
2. ✅ CSV 파일 로드 (`category.csv`)
3. ✅ 카테고리 데이터 처리 및 매핑
4. ✅ 결과 저장

---

## 문제 해결

### 문제 1: "Connection refused" 오류

**증상:**
```
❌ Failed to connect to Chrome via CDP
Error: browserType.connectOverCDP: connect ECONNREFUSED 127.0.0.1:9223
```

**해결 방법:**
1. 모든 Chrome 창 완전히 닫기
   ```cmd
   taskkill /F /IM chrome.exe
   ```

2. 3초 대기 후 다시 Chrome 디버깅 모드로 실행
   ```cmd
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9223 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data"
   ```

3. Chrome이 완전히 로드될 때까지 대기 (약 5-8초)

4. 연결 테스트:
   ```cmd
   curl http://127.0.0.1:9223/json/version
   ```

5. JSON 응답이 나오면 스크립트 실행

### 문제 2: 계정 선택 창이 나타남

**증상:**
Chrome 실행 시 계정 선택 창에서 멈춤

**해결 방법:**
- 계정을 선택하고 진행하세요
- Chrome이 완전히 로드될 때까지 기다린 후 스크립트 실행

### 문제 3: 확장 프로그램이 로드되지 않음

**증상:**
"시크릿 모드 또는 게스트 모드에서는 항목을 추가하거나 삭제할 수 없습니다"

**해결 방법:**
✅ **현재 CDP 연결 방식을 사용하면 이 문제가 해결됩니다!**
- 일반 Chrome 프로필을 사용하므로 확장 프로그램이 정상 작동

### 문제 4: Google Sheets 시트 선택 실패

**증상:**
시트 탭으로 이동하지 못함

**해결 방법:**
1. `.env` 파일의 `SHEET` 값이 정확한지 확인
2. Google Sheets 로딩 시간 증가 (코드의 timeout 값 조정)

### 문제 5: 로그인 실패

**증상:**
로그인 페이지에서 진행되지 않음

**해결 방법:**
1. `.env` 파일의 ID/PW 확인
2. 로그인 페이지 URL 확인 (`TARGET_SITES`)
3. 네트워크 연결 확인

---

## 기술 상세

### CDP (Chrome DevTools Protocol) 연결 방식

**왜 CDP를 사용하나?**
- ❌ Playwright 기본 실행: 확장 프로그램 설치 불가 (시크릿 모드 제약)
- ✅ CDP 연결: 이미 실행 중인 Chrome에 연결하여 확장 프로그램 사용 가능

**연결 흐름:**
```
Chrome (디버깅 모드) ←→ CDP (포트 9223) ←→ Playwright ←→ 자동화 스크립트
```

### 파일 구조

```
D:\Projects\CategoryMapping\
├── .env                          # 환경 변수 (보안 정보)
├── .gitignore                    # Git 제외 파일 목록
├── package.json                  # Node.js 프로젝트 설정
├── process-categories.js         # 메인 자동화 스크립트
├── start-chrome-debug.bat        # Chrome 디버깅 모드 실행 스크립트
├── login.js                      # 로그인 전용 스크립트
├── category.csv                  # 카테고리 데이터
├── README.md                     # 프로젝트 설명
├── SETUP_GUIDE.md               # 이 파일
├── screenshots/                  # 스크린샷 저장 디렉토리
└── chrome-automation-profile/    # Chrome 프로필 (Git 제외)
```

---

## 일일 사용 체크리스트

### 🌅 작업 시작 전

- [ ] 1. 모든 Chrome 창 닫기
- [ ] 2. `start-chrome-debug.bat` 실행
- [ ] 3. Chrome 완전히 로드 대기 (5-8초)
- [ ] 4. CDP 연결 테스트: `curl http://127.0.0.1:9223/json/version`
- [ ] 5. JSON 응답 확인

### 🚀 스크립트 실행

- [ ] 6. 새 터미널 열기
- [ ] 7. `cd D:\Projects\CategoryMapping`
- [ ] 8. `npm run process`
- [ ] 9. 메뉴에서 원하는 기능 선택
- [ ] 10. 작업 완료 확인

### 🌙 작업 종료 후

- [ ] 11. 스크립트 정상 종료 확인
- [ ] 12. 결과 파일 확인 (CSV, 스크린샷 등)
- [ ] 13. Chrome 창 닫기 (선택사항)
- [ ] 14. 로그 확인 (오류 발생 시)

---

## 추가 정보

### 포트 변경이 필요한 경우

포트 9223이 이미 사용 중이라면:

1. `.env` 파일 수정:
   ```env
   CDP_URL=http://127.0.0.1:9224
   ```

2. `start-chrome-debug.bat` 수정:
   ```bat
   --remote-debugging-port=9224
   ```

### 로그 확인

문제 발생 시 콘솔 출력을 확인하세요:
- ✅ 초록색 체크마크: 성공
- ❌ 빨간색 X: 오류
- ⚠️ 노란색 경고: 주의 필요

### 지원

문제가 계속 발생하면:
1. 콘솔 출력 전체를 저장
2. 오류 메시지 스크린샷
3. `.env` 파일 설정 확인 (비밀번호 제외)

---

## 버전 정보

- **Version:** 1.0.0
- **Last Updated:** 2025-11-06
- **Node.js:** v14+
- **Playwright:** ^1.40.0
- **Chrome:** Latest stable version

---

## 라이선스

이 프로젝트는 내부 사용 목적으로 제작되었습니다.
