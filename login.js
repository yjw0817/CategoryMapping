const { chromium } = require('playwright');

async function login() {
  // 브라우저 실행
  const browser = await chromium.launch({
    headless: false, // 브라우저 UI를 표시하려면 false로 설정
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('로그인 페이지로 이동 중...');

    // 로그인 페이지로 이동
    await page.goto('https://tmg4696.mycafe24.com/mall/admin/admin_category_new.php');

    console.log('아이디와 비밀번호 입력 중...');

    // 아이디와 비밀번호 입력
    await page.locator('input[name="login_id"]').fill('yjw0817');
    await page.locator('input[name="login_pass"]').fill('workhard1!');

    console.log('로그인 버튼 클릭 중...');

    // 로그인 버튼 클릭
    await page.getByRole('button', { name: '로그인' }).click();

    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');

    console.log('로그인 성공!');
    console.log('현재 URL:', page.url());

    // 로그인 성공 확인
    if (page.url().includes('admin.php')) {
      console.log('✅ 관리자 페이지 접속 완료');
    }

    console.log('정책적용 메뉴 클릭 중...');

    // 정책적용 버튼 클릭
    await page.getByRole('button', { name: '정책적용' }).click();
    await page.waitForTimeout(1000); // 드롭다운 메뉴가 나타날 때까지 대기

    console.log('카테고리 관리 및 정책적용(단계형) 메뉴 클릭 중...');

    // 카테고리 관리 및 정책적용(단계형) 링크 클릭
    await page.getByRole('link', { name: '카테고리 관리 및 정책적용(단계형)' }).click();
    await page.waitForLoadState('networkidle');

    console.log('✅ 카테고리 관리 페이지 접속 완료');
    console.log('현재 URL:', page.url());

    console.log('11st.co.kr/amazon 사이트 선택 중...');

    // 11st.co.kr/amazon 사이트 클릭
    await page.evaluate(() => {
      document.getElementById('100000000000000000').click();
    });
    await page.waitForTimeout(1000); // 페이지 업데이트 대기

    console.log('✅ 11st.co.kr/amazon 사이트 선택 완료');

    // 최종 스크린샷 저장
    await page.screenshot({ path: 'category_page.png' });
    console.log('스크린샷 저장 완료: category_page.png');

    // 브라우저를 닫지 않고 유지하려면 아래 주석 처리
    // await browser.close();

  } catch (error) {
    console.error('❌ 로그인 중 오류 발생:', error);
    await page.screenshot({ path: 'login_error.png' });
    console.log('오류 스크린샷 저장: login_error.png');
    await browser.close();
  }
}

// 스크립트 실행
login();
