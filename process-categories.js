const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const readline = require('readline');
const inquirer = require('inquirer');
require('dotenv').config();

// Create readline interface for user input
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Show main menu
async function showMainMenu() {
  const rl = createReadlineInterface();

  return new Promise((resolve) => {
    console.log('\n' + '='.repeat(60));
    console.log('🏪 11st Category Management System');
    console.log('='.repeat(60));
    console.log('1. 사이트 대량상품수집');
    console.log('2. 카테고리 매핑');
    console.log('3. 수집조건 수정');
    console.log('4. 유통경로확인요청 응답메일 보내기');
    console.log('5. 닫기');
    console.log('='.repeat(60));

    rl.question('선택하세요 (1-5): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Show category mapping menu
async function showCategoryMappingMenu(unprocessedCount, failedCount, totalCount, pngCount) {
  const rl = createReadlineInterface();

  return new Promise((resolve) => {
    console.log('\n' + '='.repeat(60));
    console.log('📋 Category Mapping Process Menu');
    console.log('='.repeat(60));
    console.log(`1. 미실시된 아이템 (${unprocessedCount}개)`);
    console.log(`2. 오류난 아이템 (${failedCount}개)`);
    console.log(`3. 전체 아이템 (${totalCount}개)`);
    console.log(`5. PNG 파일 삭제 (${pngCount}개)`);
    console.log(`6. 메인 메뉴로`);
    console.log('='.repeat(60));

    rl.question('선택하세요 (1-6): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Delete all PNG files
function deletePngFiles() {
  const screenshotsDir = 'screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    console.log('\n✅ Screenshots folder does not exist');
    return 0;
  }

  const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
  let deletedCount = 0;

  files.forEach(file => {
    fs.unlinkSync(`${screenshotsDir}/${file}`);
    deletedCount++;
  });

  console.log(`\n✅ Deleted ${deletedCount} PNG files from screenshots folder`);
  return deletedCount;
}

// Count PNG files
function countPngFiles() {
  const screenshotsDir = 'screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    return 0;
  }

  const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
  return files.length;
}

// Save last attempted ID
function saveLastAttemptedId(id) {
  fs.writeFileSync('last_attempted_id.txt', id);
}

// Get last attempted ID
function getLastAttemptedId() {
  if (fs.existsSync('last_attempted_id.txt')) {
    return fs.readFileSync('last_attempted_id.txt', 'utf-8').trim();
  }
  return null;
}

// Get processed IDs from logs
function getProcessedIds() {
  const processedIds = new Set();

  // Read successful IDs from processed.csv if exists
  if (fs.existsSync('processed.csv')) {
    const content = fs.readFileSync('processed.csv', 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    records.forEach(record => processedIds.add(record.ID));
  }

  return processedIds;
}

// Get failed IDs from error logs
function getFailedIds() {
  const failedIds = new Set();

  // Read from failed_mappings.json
  if (fs.existsSync('failed_mappings.json')) {
    const failedMappings = JSON.parse(fs.readFileSync('failed_mappings.json', 'utf-8'));
    failedMappings.forEach(item => failedIds.add(item.ID));
  }

  // Read from errors.json
  if (fs.existsSync('errors.json')) {
    const errors = JSON.parse(fs.readFileSync('errors.json', 'utf-8'));
    errors.forEach(item => failedIds.add(item.ID));
  }

  return failedIds;
}

// Save successful processing to CSV
function saveProcessedItem(item) {
  const csvData = stringify([item], {
    header: !fs.existsSync('processed.csv'),
    columns: ['Level', 'ID', 'Name', 'ParentID', 'ParentName', 'FullPath', 'URL']
  });

  fs.appendFileSync('processed.csv', csvData);
}

// Export failed items to CSV
function exportFailedItemsToCSV(failedItems, errors) {
  if (failedItems.length === 0 && errors.length === 0) {
    console.log('\n✅ No failed items to export');
    return;
  }

  const allFailedIds = new Set();
  failedItems.forEach(item => allFailedIds.add(item.ID));
  errors.forEach(item => allFailedIds.add(item.ID));

  // Read original CSV to get full data
  const csvContent = fs.readFileSync('category.csv', 'utf-8');
  const allRecords = parse(csvContent, { columns: true, skip_empty_lines: true });

  const failedRecords = allRecords.filter(record => allFailedIds.has(record.ID));

  if (failedRecords.length > 0) {
    const csvData = stringify(failedRecords, {
      header: true,
      columns: ['Level', 'ID', 'Name', 'ParentID', 'ParentName', 'FullPath', 'URL']
    });

    fs.writeFileSync('failed_items.csv', csvData);
    console.log(`\n📝 Failed items exported to: failed_items.csv (${failedRecords.length} items)`);
  }
}

// Login function
async function loginToSite(contextOrPage) {
  // If it's a page, use it directly; if it's a context, create a new page
  let page;
  let context;

  if (contextOrPage.goto) {
    // It's already a page
    page = contextOrPage;
    context = page.context();
  } else {
    // It's a context, create a new page
    context = contextOrPage;
    page = await context.newPage();
  }

  const loginUrl = process.env.TARGET_SITES || 'https://tmg4696.mycafe24.com/mall/admin/admin.php';

  console.log('🔐 Checking login status...');
  await page.goto(loginUrl);
  await page.waitForLoadState('networkidle');

  // Check if already logged in by looking for login page elements
  const loginIdInput = await page.locator('input[name="login_id"]').count();

  if (loginIdInput > 0) {
    // Login page detected - need to login
    console.log('🔑 Login required, logging in...');
    await page.locator('input[name="login_id"]').fill(process.env.ID || 'yjw0817');
    await page.locator('input[name="login_pass"]').fill(process.env.PW || 'workhard1!');
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForLoadState('networkidle');
    console.log('✅ Login successful\n');
  } else {
    // Already logged in
    console.log('✅ Already logged in, skipping login\n');
  }

  return { context, page };
}

// Navigate to bulk product collection page and process
async function navigateToBulkCollection(browser, context, page) {
  console.log('🛒 Starting bulk product collection...');

  // Find all CSV files in the project and subdirectories
  const csvFolder = path.join(__dirname, '상품 카테고리 수집 URL');
  let csvFiles = [];

  try {
    if (fs.existsSync(csvFolder)) {
      const files = fs.readdirSync(csvFolder);
      csvFiles = files
        .filter(file => file.endsWith('.csv'))
        .map(file => ({
          name: file,
          value: path.join(csvFolder, file)
        }));
    }
  } catch (error) {
    console.error(`⚠️ Error reading CSV folder: ${error.message}`);
  }

  // If no CSV files found, use default path
  if (csvFiles.length === 0) {
    csvFiles.push({
      name: '상품 카테고리 수집 URL - 11번가 아마존(섬김Trade).csv (기본)',
      value: './상품 카테고리 수집 URL/상품 카테고리 수집 URL - 11번가 아마존(섬김Trade).csv'
    });
  }

  // Add option to enter custom path
  csvFiles.push({
    name: '📝 직접 입력...',
    value: 'CUSTOM'
  });

  // Ask user to select CSV file
  const { csvPath } = await inquirer.prompt([
    {
      type: 'list',
      name: 'csvPath',
      message: 'CSV 파일을 선택하세요:',
      choices: csvFiles,
      pageSize: 10
    }
  ]);

  // If user chose custom input
  let finalCsvPath = csvPath;
  if (csvPath === 'CUSTOM') {
    const { customPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customPath',
        message: 'CSV 파일 경로를 입력하세요:',
        default: './상품 카테고리 수집 URL/상품 카테고리 수집 URL - 11번가 아마존(섬김Trade).csv'
      }
    ]);
    finalCsvPath = customPath;
  }

  // Read CSV file
  console.log(`📄 Reading CSV file: ${finalCsvPath}...`);
  let csvContent;
  try {
    csvContent = fs.readFileSync(finalCsvPath, 'utf-8');
  } catch (error) {
    console.error(`❌ Failed to read CSV file: ${error.message}`);
    return;
  }

  // Parse CSV
  const records = parse(csvContent, {
    columns: false,
    skip_empty_lines: true,
    from: 3 // Skip header rows (rows 1-2)
  });

  console.log(`✅ Found ${records.length} URLs to process\n`);

  // Navigate to bulk collection page
  console.log('📦 Navigating to bulk product collection page...');
  await page.goto('https://tmg4696.mycafe24.com/mall/admin/shop/getGoods.php');
  await page.waitForLoadState('networkidle');
  console.log('✅ Bulk collection page loaded\n');

  // Process each URL
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const filterName = record[2]; // Column C (index 2)
    const url = record[3]; // Column D (index 3)

    if (!url || !url.startsWith('http')) {
      console.log(`⚠️ Skipping row ${i + 3}: No valid URL`);
      continue;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Processing ${i + 1}/${records.length}`);
    console.log(`📝 필터이름: ${filterName}`);
    console.log(`🔗 URL: ${url}`);
    console.log('='.repeat(60));

    try {
      // Navigate to bulk collection page to clear any previous state
      console.log('🔄 Navigating to bulk collection page...');
      await page.goto('https://tmg4696.mycafe24.com/mall/admin/shop/getGoods.php');
      await page.waitForLoadState('networkidle');
      console.log('✅ Page loaded\n');

      // Fill URL search input
      console.log('🔍 Entering URL...');
      const urlInput = page.locator('input[placeholder*="데이터를 수집하실 검색페이지"]');
      await urlInput.fill(url);

      // Click URL search button (let popups open/close automatically)
      console.log('🔎 Clicking search button...');
      await page.locator('a[onclick*="set_search_extension"]').click();

      // Wait for FIRST scraping process (after clicking search button)
      console.log('⏳ Waiting for initial product scraping...');
      try {
        // Wait for goods_process.gif to appear (scraping starts)
        await page.waitForSelector('img[src*="goods_process.gif"]', { state: 'visible', timeout: 10000 });
        console.log('📥 Initial scraping in progress (popup opening/closing)...');

        // Wait for goods_process.gif to disappear (scraping complete)
        await page.waitForSelector('img[src*="goods_process.gif"]', { state: 'hidden', timeout: 300000 }); // 5 minutes max
        console.log('✅ Initial scraping completed!');

        // Wait a bit for popup to close
        await page.waitForTimeout(2000);
      } catch (error) {
        console.log('ℹ️ goods_process.gif not detected during initial scraping, continuing...');
      }

      // Click "검색된 상품 모두저장" button
      console.log('💾 Clicking save all products button...');
      await page.locator('text=검색된 상품 모두저장').click();
      await page.waitForTimeout(2000);

      // Fill in the filter name in the popup
      console.log(`📝 Entering filter name: ${filterName}...`);
      const filterNameInput = page.locator('input#filter_name');
      await filterNameInput.fill(filterName);

      // Select "11아마존" from dropdown if not selected
      console.log('✅ Checking "11아마존" option...');
      const selectDropdown = page.locator('select#goods_limit_templet');
      const currentValue = await selectDropdown.inputValue().catch(() => '');

      if (!currentValue || currentValue === '') {
        // Select "11아마존" option - find option with text containing "11아마존"
        await selectDropdown.selectOption({ label: /11아마존/ });
        console.log('✅ Selected "11아마존" from dropdown');
      } else {
        console.log('✅ "11아마존" already selected');
      }

      // Click save button
      console.log('💾 Clicking save button...');
      await page.locator('a.btn-layerSave, button:has-text("저장하기"), input[value="저장하기"]').click();

      // Wait for SECOND scraping/saving process (after clicking save button)
      console.log('⏳ Waiting for product saving to start...');
      await page.waitForTimeout(2000);

      // Wait for goods_process.gif to disappear (saving complete)
      console.log('🔄 Waiting for product saving to complete (popup opening/closing)...');
      try {
        await page.waitForSelector('img[src*="goods_process.gif"]', { state: 'visible', timeout: 10000 });
        console.log('📥 Saving in progress...');
        await page.waitForSelector('img[src*="goods_process.gif"]', { state: 'hidden', timeout: 300000 }); // 5 minutes max
        console.log('✅ Saving process completed!');
      } catch (error) {
        console.log('ℹ️ goods_process.gif not detected during save, continuing...');
      }

      // Wait for final completion message in layer_page div
      console.log('⏳ Waiting for final completion message...');
      try {
        await page.waitForFunction(
          () => {
            const layerPage = document.querySelector('#layer_page');
            if (layerPage) {
              const text = layerPage.textContent || '';
              return text.includes('신규상품의 저장이 완료되었습니다');
            }
            return false;
          },
          { timeout: 120000 } // 2 minutes timeout
        );
        console.log('✅ Save completed successfully! Message found in #layer_page');
      } catch (error) {
        console.log('⚠️ Completion message not found within timeout, but continuing...');
      }

      console.log(`✅ Completed ${i + 1}/${records.length}\n`);

    } catch (error) {
      console.error(`❌ Error processing URL: ${error.message}`);
      console.log('⚠️ Continuing to next URL...\n');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All URLs processed!');
  console.log('='.repeat(60));
}

// Navigate to category management page
async function navigateToCategoryManagement(page) {
  console.log('🗂️ Navigating to category management...');
  await page.goto('https://tmg4696.mycafe24.com/mall/admin/admin_category_new.php');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: '정책적용' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('link', { name: '카테고리 관리 및 정책적용(단계형)' }).click();
  await page.waitForLoadState('networkidle');
  console.log('✅ Category management page loaded\n');

  // Select 11st.co.kr/amazon site
  console.log('🌐 Selecting 11st.co.kr/amazon site...');
  await page.evaluate(() => {
    document.getElementById('100000000000000000').click();
  });
  await page.waitForTimeout(1000);
  console.log('✅ Site selected\n');
}

// Modify collection conditions
async function modifyCollectionConditions(page) {
  const rl = createReadlineInterface();

  console.log('\n' + '='.repeat(60));
  console.log('⚙️ 수집조건 수정');
  console.log('='.repeat(60));

  // Get search keyword from user
  const keyword = await new Promise((resolve) => {
    rl.question('검색어를 입력하세요: ', (answer) => {
      resolve(answer.trim());
    });
  });

  // Get collection count from user
  const collectionCount = await new Promise((resolve) => {
    rl.question('수집수를 입력하세요: ', (answer) => {
      resolve(answer.trim());
    });
  });

  // Confirm with user
  console.log('\n입력하신 정보:');
  console.log(`검색어: ${keyword}`);
  console.log(`수집수: ${collectionCount}`);

  const confirm = await new Promise((resolve) => {
    rl.question('\n진행하시겠습니까? (Y/N): ', (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase());
    });
  });

  if (confirm !== 'Y') {
    console.log('\n❌ 취소되었습니다.\n');
    return;
  }

  try {
    // Navigate to collection conditions page
    console.log('\n🔄 수집조건 페이지로 이동 중...');
    await page.goto('https://tmg4696.mycafe24.com/mall/admin/admin_group.php');
    await page.waitForLoadState('networkidle');
    console.log('✅ 페이지 로드 완료\n');

    // Change view to 100 items per page
    console.log('📊 100개씩 보기로 변경...');
    const viewSelect = page.locator('select#ft_num');
    await viewSelect.selectOption('100');
    await page.waitForLoadState('networkidle');
    console.log('✅ 100개씩 보기 설정 완료\n');

    // Enter search keyword
    console.log(`🔍 검색어 입력: ${keyword}`);
    const keywordInput = page.locator('input[name="sch_keyword"]');
    await keywordInput.fill(keyword);

    // Click search button
    console.log('🔎 검색 버튼 클릭...');
    await page.locator('a[onclick*="search_filter"]').click();
    await page.waitForLoadState('networkidle');
    console.log('✅ 검색 완료\n');

    // Setup dialog handler for alerts
    page.on('dialog', async (dialog) => {
      console.log(`   📢 Alert: ${dialog.message()}`);
      await dialog.accept();
    });

    const userInputCount = parseInt(collectionCount);
    let totalSuccessCount = 0;
    let totalFailCount = 0;
    let totalSkippedCount = 0;
    let currentPage = 1;
    let hasNextPage = true;

    // Process all pages
    while (hasNextPage) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 페이지 ${currentPage} 처리 중`);
      console.log('='.repeat(60));

      // Get all collection count spans on current page
      const countSpans = await page.locator('span[id^="div_uid_count_"]').all();
      console.log(`현재 페이지 필터 개수: ${countSpans.length}\n`);

      if (countSpans.length === 0) {
        console.log('⚠️ 검색 결과가 없습니다.');
        break;
      }

      // Get page HTML to extract collected counts
      const pageHTML = await page.content();
      const collectedRegex = /수집개수<\/font>:\s*(\d+)개/g;
      const collectedMatches = [...pageHTML.matchAll(collectedRegex)];

      // Process each filter on current page
      let processedOnPage = 0;

      for (let i = 0; i < countSpans.length; i++) {
        try {
          console.log(`\n${'='.repeat(50)}`);
          console.log(`항목 ${i + 1}/${countSpans.length} (페이지 ${currentPage})`);
          console.log('='.repeat(50));

          // Get saved count (저장된 수집수)
          const countSpan = page.locator('span[id^="div_uid_count_"]').nth(i);
          const countText = await countSpan.textContent();
          const savedCount = parseInt(countText.replace('개', '').trim());

          // Get collected count (수집개수)
          const collectedCount = collectedMatches[i] ? parseInt(collectedMatches[i][1]) : 0;

          // Calculate total
          const totalCount = savedCount + collectedCount;

          console.log(`저장된 수집수: ${savedCount}개`);
          console.log(`수집개수: ${collectedCount}개`);
          console.log(`합계: ${totalCount}개 / 목표: ${userInputCount}개`);

          // Check if modification is needed
          if (totalCount >= userInputCount) {
            console.log('✅ 이미 목표에 도달. 건너뛰기.');
            totalSkippedCount++;
            continue;
          }

          // Calculate new value to enter
          const newCount = userInputCount - collectedCount;
          console.log(`계산된 입력 값: ${newCount} (${userInputCount} - ${collectedCount})`);

          // Click modify button for this row
          const modifyButtons = await page.locator('a:has-text("수집조건수정")').all();
          console.log('"수집조건수정" 버튼 클릭...');
          await modifyButtons[i].click();
          await page.waitForTimeout(1500);

          // Find the popup page
          const context = page.context();
          const allPages = context.pages();
          let modifyPage = null;

          for (const p of allPages) {
            if (p.url().includes('admin_group_modify.php')) {
              modifyPage = p;
              break;
            }
          }

          if (!modifyPage) {
            console.log('⚠️ 팝업 페이지를 찾을 수 없습니다. 다음 항목으로...');
            totalFailCount++;
            continue;
          }

          // Setup dialog handler for popup
          modifyPage.on('dialog', async (dialog) => {
            console.log(`   📢 Popup Alert: ${dialog.message()}`);
            await dialog.accept();
          });

          // Modify the count
          const limitCountInput = modifyPage.locator('input[name="limit_count"]');
          await limitCountInput.clear();
          await limitCountInput.fill(newCount.toString());
          console.log(`✅ 값 ${newCount} 입력 완료`);

          // Save
          console.log('저장 중...');
          await modifyPage.locator('a[onclick="set_save();"]').click();
          await page.waitForTimeout(2000);
          console.log('✅ 저장 완료');

          totalSuccessCount++;
          processedOnPage++;

        } catch (error) {
          console.error(`❌ 오류 발생: ${error.message}`);
          totalFailCount++;
        }
      }

      console.log(`\n📊 페이지 ${currentPage} 완료: 처리 ${processedOnPage}개`);

      // Check for next page
      const nextPageLink = page.locator('a:has-text("다음")').first();
      const nextPageExists = await nextPageLink.count() > 0;

      if (nextPageExists) {
        console.log('\n➡️ 다음 페이지로 이동 중...');
        await nextPageLink.click();
        await page.waitForLoadState('networkidle');
        currentPage++;
      } else {
        console.log('\n✅ 마지막 페이지입니다.');
        hasNextPage = false;
      }
    }

    // Final Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 전체 수집조건 수정 완료');
    console.log('='.repeat(60));
    console.log(`✅ 수정 성공: ${totalSuccessCount}개`);
    console.log(`⏭️ 건너뛰기: ${totalSkippedCount}개`);
    console.log(`❌ 실패: ${totalFailCount}개`);
    console.log(`📊 총 확인: ${totalSuccessCount + totalSkippedCount + totalFailCount}개`);
    console.log(`📄 처리한 페이지: ${currentPage}개\n`);

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  }
}

// Open Gmail tabs for multiple accounts
async function openGmailTabs(context) {
  console.log('\n📧 Opening Gmail tabs...');

  // Parse Gmail accounts from environment variable
  const gmailAccountsEnv = process.env.GMAIL_ACCOUNTS || '';

  if (!gmailAccountsEnv) {
    console.log('❌ No Gmail accounts found in .env file');
    console.log('   Please add GMAIL_ACCOUNTS to .env file');
    console.log('   Format: GMAIL_ACCOUNTS=email1@gmail.com,email2@gmail.com');
    return [];
  }

  const accounts = gmailAccountsEnv.split(',').map(email => {
    return { email: email.trim() };
  });

  console.log(`✅ Found ${accounts.length} Gmail account(s)\n`);

  const gmailPages = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];

    try {
      console.log(`${'='.repeat(60)}`);
      console.log(`📧 Opening Gmail for: ${account.email} (${i + 1}/${accounts.length})`);
      console.log('='.repeat(60));

      // Create new tab
      const gmailPage = await context.newPage();

      // Navigate to Gmail with account slot (u/0, u/1, u/2, etc.)
      const gmailUrl = `https://mail.google.com/mail/u/${i}`;

      console.log(`🌐 Navigating to Gmail (account slot ${i})...`);
      console.log(`   Target account: ${account.email}`);

      await gmailPage.goto(gmailUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      // Wait a bit for page to load
      await gmailPage.waitForTimeout(2000);

      // Check if already logged in
      const url = gmailPage.url();
      if (url.includes('mail.google.com/mail')) {
        console.log(`✅ Gmail loaded (account slot ${i})`);
      } else if (url.includes('accounts.google.com')) {
        console.log(`🔑 Login page - Please add account: ${account.email}`);
      } else {
        console.log(`✅ Gmail loaded`);
      }

      console.log(`   URL: ${url.substring(0, 60)}...\n`);

      gmailPages.push({
        page: gmailPage,
        email: account.email
      });

      // Small delay between opening tabs
      await gmailPage.waitForTimeout(1000);

    } catch (error) {
      console.error(`❌ Error opening Gmail for ${account.email}:`, error.message);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Opened ${gmailPages.length}/${accounts.length} Gmail tab(s)`);
  console.log('='.repeat(60));

  // Check login status
  const loggedInCount = gmailPages.filter(p => p.page.url().includes('mail.google.com/mail')).length;
  const loginNeededCount = gmailPages.filter(p => p.page.url().includes('accounts.google.com')).length;

  console.log(`📊 Status:`);
  console.log(`   ✅ Already logged in: ${loggedInCount}`);
  console.log(`   🔑 Login needed: ${loginNeededCount}`);

  if (loginNeededCount > 0) {
    console.log(`\n💡 How to add accounts:`);
    console.log(`   1. Click profile icon in the Gmail tab`);
    console.log(`   2. Select "다른 계정 추가" (Add another account)`);
    console.log(`   3. Login with the account shown above`);
    console.log(`   4. Once added, this account will be remembered for next time!`);
  } else if (accounts.length > 1) {
    console.log(`\n✅ All accounts are ready!`);
    console.log(`   Each tab should show a different account now.`);
  }

  console.log('');

  return gmailPages;
}

// Extract product IDs from Coupang distribution channel confirmation emails
async function extractCoupangDistributionRequests(gmailPages) {
  console.log('\n📧 Extracting Coupang distribution channel requests...\n');

  const allResults = [];

  for (let i = 0; i < gmailPages.length; i++) {
    const { page, email } = gmailPages[i];

    try {
      console.log(`${'='.repeat(60)}`);
      console.log(`📧 Processing account: ${email} (${i + 1}/${gmailPages.length})`);
      console.log('='.repeat(60));

      // Check if logged in
      if (!page.url().includes('mail.google.com/mail')) {
        console.log('⚠️  Not logged in, skipping...\n');
        continue;
      }

      // Navigate to inbox if not already there
      console.log('🔍 Searching for emails from sellergating@coupang.com...');

      // Navigate to inbox first
      await page.goto(`https://mail.google.com/mail/u/${i}/#inbox`, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      await page.waitForTimeout(2000);

      // Calculate date 10 days ago
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const dateStr = `${tenDaysAgo.getFullYear()}/${tenDaysAgo.getMonth() + 1}/${tenDaysAgo.getDate()}`;

      // Use Gmail search UI - type in search box and click search
      // -{심사종료} excludes emails with "심사종료" in the subject
      const searchQuery = `from:(sellergating@coupang.com) subject:(유통경로 확인 요청 안내) 심사중 -{심사종료} after:${dateStr}`;

      console.log(`   Query: ${searchQuery}`);

      // Find and focus search input
      const searchInput = await page.locator('input[aria-label="Search mail"], input.gb_ye').first();
      await searchInput.click();
      await page.waitForTimeout(500);

      // Clear and type search query
      await searchInput.fill(searchQuery);
      await page.waitForTimeout(1000);

      // Press Enter to search
      await searchInput.press('Enter');
      await page.waitForTimeout(3000); // Wait for search results to load

      // Verify we're on search results page and save the URL
      let searchResultsUrl = page.url();
      console.log(`   Current URL: ${searchResultsUrl}`);

      if (!searchResultsUrl.includes('#search') && !searchResultsUrl.includes('search/')) {
        console.log('⚠️  Search did not navigate to results page. Retrying...');
        await page.waitForTimeout(2000);
        searchResultsUrl = page.url();
      }

      // Get email list
      console.log('📬 Loading email list...');

      // Wait for email list to be visible
      await page.waitForTimeout(2000);

      // Count email rows using page.evaluate for better stability
      // Use second grid table (search results)
      const emailCount = await page.evaluate(() => {
        const gridTables = document.querySelectorAll('table[role="grid"].F.cf.zt');

        // Use second grid table if available
        if (gridTables.length < 2) return 0;

        const searchTable = gridTables[1];
        const rows = searchTable.querySelectorAll('tbody tr.zA');

        return rows.length;
      });

      console.log(`✅ Found ${emailCount} email(s)`);

      if (emailCount === 0) {
        console.log('ℹ️  No matching emails found for this account.\n');
        continue;
      }

      if (emailCount > 20) {
        console.log(`⚠️  Large number of emails detected. This may take a while...`);
        console.log(`   Estimated time: ~${Math.ceil(emailCount * 5 / 60)} minutes\n`);
      } else {
        console.log('');
      }

      const accountResults = {
        account: email,
        emails: []
      };

      let successCount = 0;
      let errorCount = 0;

      // Click first email to start
      if (emailCount > 0) {
        const firstClicked = await page.evaluate(() => {
          const gridTables = document.querySelectorAll('table[role="grid"].F.cf.zt');

          if (gridTables.length < 2) {
            console.log('Second grid table not found');
            return false;
          }

          const secondTable = gridTables[1];
          const firstRow = secondTable.querySelector('tbody tr.zA');

          if (!firstRow) {
            console.log('First row not found in second table');
            return false;
          }

          // Click on the link element inside the row
          const linkElement = firstRow.querySelector('div.xS[role="link"]');
          if (linkElement) {
            linkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => linkElement.click(), 300);
            return true;
          } else {
            // Fallback to clicking the row itself
            firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => firstRow.click(), 300);
            return true;
          }
        });

        if (!firstClicked) {
          console.log('⚠️  Could not click first email\n');
          continue;
        }

        await page.waitForTimeout(3000);
      }

      // Process each email
      for (let j = 0; j < emailCount; j++) {
        try {
          console.log(`  📨 Processing email ${j + 1}/${emailCount}...`);

          // Extract email info
          const emailData = await page.evaluate(() => {
            // Get subject
            const subjectElement = document.querySelector('h2.hP');
            const subject = subjectElement ? subjectElement.textContent.trim() : '';

            // Get sender email address
            const senderElement = document.querySelector('span.go');
            let sender = '';
            if (senderElement) {
              const emailMatch = senderElement.getAttribute('email') ||
                                senderElement.textContent.match(/<(.+?)>/) ||
                                senderElement.textContent.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
              sender = emailMatch ? (typeof emailMatch === 'string' ? emailMatch : emailMatch[1]) : '';
            }

            // Get date
            const dateElement = document.querySelector('span.g3');
            const date = dateElement ? dateElement.getAttribute('title') || dateElement.textContent : '';

            // Get email body
            const bodyElement = document.querySelector('div.a3s.aiL');
            const bodyText = bodyElement ? bodyElement.textContent : '';

            return { subject, sender, date, bodyText };
          });

          console.log(`     Sender: ${emailData.sender}`);
          console.log(`     Subject: ${emailData.subject}`);
          console.log(`     Date: ${emailData.date}`);

          // CLIENT-SIDE FILTERING: Check if email matches criteria
          // (sender and review status already filtered by Gmail search)
          const subjectMatch = emailData.subject && emailData.subject.includes('유통경로 확인 요청 안내');

          // Check if user already replied (look for user's email in reply section)
          const hasReplied = await page.evaluate((userEmail) => {
            const userReplySpan = document.querySelector(`span.gD[email="${userEmail}"]`);
            return !!userReplySpan;
          }, email);

          console.log(`     Reply Check: hasReplied=${hasReplied}`);

          if (!subjectMatch || hasReplied) {
            console.log(`     ⚠️  Email doesn't match criteria - skipping`);
            if (!subjectMatch) console.log(`        - Wrong subject: ${emailData.subject}`);
            if (hasReplied) console.log(`        - Already replied to this email`);

            // Click "Older" button to move to next email
            if (j < emailCount - 1) {
              try {
                const olderClicked = await page.evaluate(() => {
                  // Try both English "Older" and Korean "예전"
                  const olderButtons = document.querySelectorAll('div[aria-label="Older"], div[aria-label="예전"]');
                  const visibleButton = Array.from(olderButtons).find(btn =>
                    btn.offsetParent !== null && !btn.getAttribute('aria-disabled')
                  );
                  if (visibleButton) {
                    visibleButton.click();
                    return true;
                  }
                  return false;
                });

                if (olderClicked) {
                  await page.waitForTimeout(2000);
                } else {
                  console.log(`        ⚠️  Older button not available`);
                  break;
                }
              } catch (e) {
                console.log(`        ⚠️  Failed to navigate to next email`);
                break;
              }
            }
            continue;
          }

          // Parse body for product IDs
          const parsedData = parseEmailBody(emailData.bodyText);

          // Try to extract brand from subject if not found in body
          if (!parsedData.brand && emailData.subject) {
            const subjectBrandMatch = emailData.subject.match(/_([가-힣a-zA-Z&\s]+)$/);
            if (subjectBrandMatch) {
              parsedData.brand = subjectBrandMatch[1].trim();
            }
          }

          accountResults.emails.push({
            subject: emailData.subject,
            date: emailData.date,
            type: parsedData.type,
            brand: parsedData.brand,
            products: parsedData.products
          });

          console.log(`     Type: ${parsedData.type}`);
          if (parsedData.brand) {
            console.log(`     Brand: ${parsedData.brand}`);
          }
          console.log(`     Products: ${parsedData.products.length} item(s)`);

          // Display product details
          if (parsedData.products.length > 0) {
            parsedData.products.forEach((product, idx) => {
              console.log(`       ${idx + 1}. ID: ${product.id} | ${product.name}`);
            });
          }

          successCount++;

          // Click "Older" button to move to next email
          if (j < emailCount - 1) {
            try {
              const olderClicked = await page.evaluate(() => {
                // Try both English "Older" and Korean "예전"
                const olderButtons = document.querySelectorAll('div[aria-label="Older"], div[aria-label="예전"]');
                const visibleButton = Array.from(olderButtons).find(btn =>
                  btn.offsetParent !== null && !btn.getAttribute('aria-disabled')
                );
                if (visibleButton) {
                  visibleButton.click();
                  return true;
                }
                return false;
              });

              if (olderClicked) {
                await page.waitForTimeout(2000);
              } else {
                console.log(`     ⚠️  Older button not available, end of emails`);
                break;
              }
            } catch (e) {
              console.log(`     ⚠️  Failed to navigate to next email`);
              break;
            }
          }

        } catch (error) {
          errorCount++;
          const errorMsg = error.message.split('\n')[0];
          console.log(`     ⚠️  Error: ${errorMsg.substring(0, 80)}`);

          // Try to recover and go back to list
          try {
            const currentUrl = page.url();

            // If we're on an email page, try to go back
            if (currentUrl.includes('mail.google.com/mail')) {
              console.log(`     🔄 Attempting to recover...`);

              // Try clicking back arrow in Gmail UI
              const backClicked = await page.evaluate(() => {
                const backButton = document.querySelector('div[aria-label="Back to Search results"], div[aria-label="검색결과로 돌아가기"]');
                if (backButton) {
                  backButton.click();
                  return true;
                }
                return false;
              });

              if (!backClicked) {
                // Use browser back if UI back button not found
                await page.goBack({ timeout: 3000 });
              }

              await page.waitForTimeout(2000);
            }
          } catch (e) {
            console.log(`     ⚠️  Could not recover, reloading search...`);
            // Last resort: reload search page
            try {
              await page.goto(searchResultsUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 10000
              });
              await page.waitForTimeout(2000);
            } catch (reloadError) {
              console.log(`     ❌ Failed to reload, skipping rest of emails for this account`);
              break; // Exit the email loop for this account
            }
          }
        }

        // Show progress every 10 emails
        if ((j + 1) % 10 === 0 || j + 1 === emailCount) {
          console.log(`\n  📊 Progress: ${j + 1}/${emailCount} (✅ ${successCount} | ⚠️ ${errorCount})\n`);
        }
      }

      allResults.push(accountResults);
      console.log(`✅ Completed ${email}: ${successCount} successful, ${errorCount} errors\n`);

    } catch (error) {
      console.error(`❌ Error processing ${email}:`, error.message);
    }
  }

  return allResults;
}

// Parse email body to extract product IDs and type
function parseEmailBody(bodyText) {
  const result = {
    type: 'unknown',
    brand: null,
    products: []
  };

  // Try to extract brand from multiple patterns
  // Pattern: "브랜드: XXX" or just "XXX" after "판매 브랜드"
  let brandMatch = bodyText.match(/브랜드:\s*([^\n가-힣\s]{2,30})/);
  if (!brandMatch) {
    // Try to find brand in subject or body after "판매 브랜드"
    brandMatch = bodyText.match(/판매 브랜드[:\s]*([가-힣a-zA-Z&\s]+?)[\n예시]/);
  }
  if (!brandMatch) {
    // Try to extract from pattern like "A01294438_브랜드명"
    brandMatch = bodyText.match(/A\d+_([가-힣a-zA-Z&\s]+)/);
  }

  // Pattern 1: Brand-based (■ 판매 브랜드)
  if (bodyText.includes('■ 판매 브랜드') || bodyText.includes('판매 브랜드')) {
    result.type = 'brand';

    if (brandMatch) {
      result.brand = brandMatch[1].trim();
    }

    // Extract example product IDs
    const idMatches = bodyText.matchAll(/ID:\s*(\d+)\(([^)]+)\)/g);
    for (const match of idMatches) {
      result.products.push({
        id: match[1],
        name: match[2]
      });
    }
  }
  // Pattern 2 & 3: Single or Multiple items
  else if (bodyText.includes('VendorInventory ID / Item Name') || bodyText.includes('ID:')) {
    // Extract all product IDs
    const idMatches = bodyText.matchAll(/ID:\s*(\d+)\(([^)]+)\)/g);
    const products = [];

    for (const match of idMatches) {
      products.push({
        id: match[1],
        name: match[2]
      });
    }

    result.products = products;

    if (products.length === 0) {
      result.type = 'unknown';
    } else if (products.length === 1) {
      result.type = 'single';
    } else {
      result.type = 'multiple';
    }

    // Check if it's actually a brand type by looking for brand indicators
    if (brandMatch && (bodyText.includes('대상 상품:') || bodyText.includes('브랜드의 모든 상품'))) {
      result.type = 'brand';
      result.brand = brandMatch[1].trim();
    }
  }

  return result;
}

// Save results to CSV
function saveCoupangDistributionResults(results) {
  if (results.length === 0) {
    console.log('\n⚠️  No results to save.\n');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `coupang_distribution_${timestamp}.csv`;

  // Prepare CSV data
  const csvRows = [
    ['Account', 'Email Date', 'Subject', 'Type', 'Brand', 'Product ID', 'Product Name']
  ];

  for (const accountResult of results) {
    for (const email of accountResult.emails) {
      if (email.products.length === 0) {
        // No products found
        csvRows.push([
          accountResult.account,
          email.date,
          email.subject,
          email.type,
          email.brand || '',
          '',
          ''
        ]);
      } else {
        // Add each product as a row
        for (const product of email.products) {
          csvRows.push([
            accountResult.account,
            email.date,
            email.subject,
            email.type,
            email.brand || '',
            product.id,
            product.name
          ]);
        }
      }
    }
  }

  // Convert to CSV string
  const csvContent = stringify(csvRows);

  // Save to file
  fs.writeFileSync(filename, csvContent);

  console.log(`\n✅ Results saved to: ${filename}`);
  console.log(`   Total accounts: ${results.length}`);
  console.log(`   Total emails: ${results.reduce((sum, r) => sum + r.emails.length, 0)}`);
  console.log(`   Total products: ${csvRows.length - 1}\n`);

  return filename;
}

async function processCategories(categoryList, context, page) {
  // Create screenshots folder if not exists
  const screenshotsDir = 'screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
    console.log('📁 Created screenshots folder\n');
  }

  console.log(`✅ Processing ${categoryList.length} categories\n`);

  // Error log array
  const errors = [];
  const failedMappings = []; // Track IDs with failed mappings
  let successCount = 0;

  try {

    // Process each category
    for (let i = 0; i < categoryList.length; i++) {
      const category = categoryList[i];
      const { FullPath, ID, Name } = category;

      // Save last attempted ID
      saveLastAttemptedId(ID);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing ${i + 1}/${categoryList.length}: ${FullPath}`);
      console.log(`${'='.repeat(60)}`);

      try {
        // Parse FullPath: "대분류 > 중분류 > 소분류"
        const parts = FullPath.split(' > ').map(part => part.trim());

        if (parts.length !== 3) {
          throw new Error(`Invalid FullPath format: ${FullPath}`);
        }

        const [대분류, 중분류, 소분류] = parts;

        // Click 대분류
        console.log(`  ➤ Clicking 대분류: ${대분류}`);
        await page.locator('a').filter({ hasText: 대분류 }).first().click();
        await page.waitForTimeout(500);

        // Click 중분류
        console.log(`  ➤ Clicking 중분류: ${중분류}`);
        await page.locator('a').filter({ hasText: 중분류 }).first().click();
        await page.waitForTimeout(500);

        // Click 소분류
        console.log(`  ➤ Clicking 소분류: ${소분류}`);
        await page.locator('a').filter({ hasText: 소분류 }).first().click();
        await page.waitForTimeout(500);

        // Click 카테고리 설정 button with retry logic
        console.log(`  ➤ Clicking 카테고리 설정 button`);
        let settingsPage = null;
        let retryCount = 0;
        const maxRetries = 3;

        while (!settingsPage && retryCount < maxRetries) {
          await page.locator('a').filter({ hasText: '카테고리 설정' }).first().click();
          await page.waitForTimeout(2000); // Wait for new tab to open

          // Check if settings tab opened
          const pages = context.pages();
          if (pages.length > 1) {
            settingsPage = pages[pages.length - 1];
            await settingsPage.waitForLoadState('networkidle');
            console.log(`  ➤ Settings popup opened: ${settingsPage.url()}`);
          } else {
            retryCount++;
            console.log(`  ⚠️ Popup not opened, retrying... (${retryCount}/${maxRetries})`);
          }
        }

        if (settingsPage) {

          // Type 소분류 in search box
          console.log(`  ➤ Typing search term: ${소분류}`);
          await settingsPage.locator('input#category_search_text').fill(소분류);
          await settingsPage.waitForTimeout(500);

          // Set up response listener before clicking
          console.log(`  ➤ Setting up AI mapping response listener...`);
          const responsePromise = settingsPage.waitForResponse(
            response => response.url().includes('recommend_category') ||
                        response.url().includes('category') && response.status() === 200,
            { timeout: 30000 }
          );

          // Click AI auto mapping button
          console.log(`  ➤ Clicking AI auto mapping button`);
          await settingsPage.locator('a').filter({ hasText: 'Ai 자동 매핑 시작하기' }).click();

          // Wait for AI mapping response
          console.log(`  ➤ Waiting for AI mapping response...`);
          try {
            await responsePromise;
            console.log(`  ✅ AI mapping response received`);

            // Wait for UI to update by checking if all markets are mapped
            console.log(`  ➤ Checking mapping completion...`);
            let allMapped = false;
            let checkCount = 0;
            const maxChecks = 40; // 40 checks * 0.5s = 20 seconds max

            while (!allMapped && checkCount < maxChecks) {
              const checkResult = await settingsPage.evaluate(() => {
                const marketSelects = {
                  '11번가': 'openmarket_category_search_list_11ST',
                  '옥션2.0': 'openmarket_category_search_list_AUC20',
                  'G마켓2.0': 'openmarket_category_search_list_GMK20',
                  '스마트스토어': 'openmarket_category_search_list_SMART',
                  '쿠팡': 'openmarket_category_search_list_COUP'
                };

                let mappedCount = 0;
                for (const [marketName, selectId] of Object.entries(marketSelects)) {
                  const selectElement = document.getElementById(selectId);
                  if (selectElement && selectElement.value && selectElement.value !== '') {
                    mappedCount++;
                  }
                }

                return mappedCount === 5;
              });

              if (checkResult) {
                allMapped = true;
                console.log(`  ✅ All markets mapped (checked ${checkCount + 1} times, ${(checkCount + 1) * 0.5}s)`);
              } else {
                checkCount++;
                await settingsPage.waitForTimeout(500); // 0.5 second
              }
            }

            if (!allMapped) {
              console.log(`  ⚠️ Mapping check timeout after ${maxChecks * 0.5}s - proceeding anyway`);
            }
          } catch (error) {
            console.log(`  ⚠️ AI mapping response timeout - proceeding anyway`);
            await settingsPage.waitForTimeout(5000); // Still wait for UI
          }

          // Check if all markets are mapped (excluding 11번가)
          console.log(`  ➤ Checking mapping results...`);
          const mappingResults = await settingsPage.evaluate(() => {
            const results = {
              markets: {},
              failedMarkets: [],
              debug: []
            };

            // Check specific select IDs for the 5 main markets
            const marketSelects = {
              '11번가': 'openmarket_category_search_list_11ST',
              '옥션2.0': 'openmarket_category_search_list_AUC20',
              'G마켓2.0': 'openmarket_category_search_list_GMK20',
              '스마트스토어': 'openmarket_category_search_list_SMART',
              '쿠팡': 'openmarket_category_search_list_COUP'
            };

            for (const [marketName, selectId] of Object.entries(marketSelects)) {
              const selectElement = document.getElementById(selectId);

              if (selectElement) {
                const selectedValue = selectElement.value;
                const selectedText = selectElement.options[selectElement.selectedIndex]?.text || '';

                results.debug.push({
                  market: marketName,
                  selectId: selectId,
                  value: selectedValue,
                  text: selectedText.substring(0, 50),
                  selectedIndex: selectElement.selectedIndex
                });

                // Check if mapped: value should not be empty
                if (!selectedValue || selectedValue === '') {
                  results.failedMarkets.push(marketName);
                  results.markets[marketName] = null;
                } else {
                  results.markets[marketName] = selectedText;
                }
              } else {
                results.debug.push({
                  market: marketName,
                  selectId: selectId,
                  error: 'Select element not found'
                });
                results.failedMarkets.push(marketName);
                results.markets[marketName] = null;
              }
            }

            return results;
          });

          // Count failed mappings
          const failedCount = mappingResults.failedMarkets.length;
          const mappedCount = Object.keys(mappingResults.markets).length - failedCount;

          console.log(`  ➤ Mapping results: ${mappedCount} mapped, ${failedCount} failed`);

          // Debug output
          if (mappingResults.debug && mappingResults.debug.length > 0) {
            console.log(`  📊 Debug info:`);
            mappingResults.debug.forEach(d => {
              if (d.error) {
                console.log(`     ${d.market}: ${d.error}`);
              } else {
                console.log(`     ${d.market}: idx=${d.selectedIndex}, text="${d.text.substring(0, 30)}..."`);
              }
            });
          }

          if (failedCount > 0) {
            console.log(`  ➤ Failed markets: ${mappingResults.failedMarkets.join(', ')}`);
          }

          if (failedCount > 0) {
            // Mapping failed for some markets
            console.log(`  ⚠️ Some markets failed to map - ID: ${ID}`);

            // Take screenshot of failed mapping
            const failedScreenshot = `${screenshotsDir}/failed_mapping_${i + 1}_${ID}.png`;
            await settingsPage.screenshot({
              path: failedScreenshot,
              fullPage: true
            });
            console.log(`  📸 Screenshot saved: ${failedScreenshot}`);

            failedMappings.push({
              ID,
              FullPath,
              Name,
              소분류,
              failedCount,
              mappedCount,
              failedMarkets: mappingResults.failedMarkets,
              markets: mappingResults.markets,
              screenshot: failedScreenshot
            });

            // Close the settings tab without saving
            console.log(`  ➤ Closing settings tab without saving`);
            await settingsPage.close();
            await page.waitForTimeout(500);
          } else {
            // All markets mapped successfully
            console.log(`  ✅ All markets mapped successfully!`);

            // Click save button
            console.log(`  ➤ Clicking save button`);
            await settingsPage.locator('a').filter({ hasText: '카테고리 설정저장' }).click();
            await settingsPage.waitForTimeout(1000);

            // Close the settings popup
            console.log(`  ➤ Closing settings popup after save`);
            await settingsPage.close();
            await page.waitForTimeout(500);

            // Save to processed.csv
            saveProcessedItem(category);
            successCount++;
          }
        } else {
          // Popup failed to open after all retries
          throw new Error(`Failed to open category settings popup after ${maxRetries} attempts`);
        }

        console.log(`✅ Processed (${successCount} saved, ${failedMappings.length} failed mapping)`);

      } catch (error) {
        console.error(`❌ Error processing: ${FullPath}`);
        console.error(`   Error: ${error.message}`);

        errors.push({
          index: i + 1,
          FullPath,
          ID,
          Name,
          error: error.message
        });

        // Take screenshot on error
        const errorScreenshot = `${screenshotsDir}/error_${i + 1}_${ID}.png`;
        await page.screenshot({
          path: errorScreenshot
        });
        console.log(`   Screenshot saved: ${errorScreenshot}`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Processing Complete!');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Successfully saved: ${successCount}/${categoryList.length}`);
    console.log(`⚠️ Failed mapping: ${failedMappings.length}/${categoryList.length}`);
    console.log(`❌ Errors: ${errors.length}/${categoryList.length}`);

    // Save failed mappings log
    if (failedMappings.length > 0) {
      fs.writeFileSync('failed_mappings.json', JSON.stringify(failedMappings, null, 2));
      console.log('\n📝 Failed mappings log saved to: failed_mappings.json');
      console.log('   IDs with failed mappings:');
      failedMappings.forEach(item => {
        console.log(`   - ID: ${item.ID}, Path: ${item.FullPath}`);
      });
    }

    // Save error log if there are errors
    if (errors.length > 0) {
      fs.writeFileSync('errors.json', JSON.stringify(errors, null, 2));
      console.log('\n📝 Error log saved to: errors.json');
    }

    // Export failed items to CSV
    exportFailedItemsToCSV(failedMappings, errors);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await page.screenshot({ path: `${screenshotsDir}/fatal_error.png` });
  }

  // Return results
  return { successCount, failedMappings, errors };
}

// Category Mapping submenu
async function categoryMappingMenu(browser, context, page) {

  while (true) {
    // Read CSV file
    const csvContent = fs.readFileSync('category.csv', 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    // Filter for Level=3 entries only
    const level3Categories = records.filter(record => record.Level === '3');

    // Calculate counts for menu
    const processedIds = getProcessedIds();
    const failedIds = getFailedIds();
    const lastAttemptedId = getLastAttemptedId();

    // Calculate unprocessed count: items after last attempted ID
    let unprocessedCount = 0;
    if (lastAttemptedId) {
      let foundLast = false;
      for (const cat of level3Categories) {
        if (foundLast) {
          unprocessedCount++;
        }
        if (cat.ID === lastAttemptedId) {
          foundLast = true;
        }
      }
    } else {
      unprocessedCount = level3Categories.length;
    }

    const failedCount = level3Categories.filter(cat => failedIds.has(cat.ID)).length;
    const totalCount = level3Categories.length;
    const pngCount = countPngFiles();

    // Show menu with counts
    const choice = await showCategoryMappingMenu(unprocessedCount, failedCount, totalCount, pngCount);

    if (choice === '6') {
      // Return to main menu
      return;
    }

    if (choice === '5') {
      // Delete PNG files
      deletePngFiles();
      continue;
    }

    // Check if logged in before processing
    if (!page) {
      console.log('\n❌ Please login first from main menu (option 1)');
      continue;
    }

    let categoryList = [];

    if (choice === '1') {
      // Unprocessed items: items after last attempted ID
      if (lastAttemptedId) {
        let foundLast = false;
        for (const cat of level3Categories) {
          if (foundLast) {
            categoryList.push(cat);
          }
          if (cat.ID === lastAttemptedId) {
            foundLast = true;
          }
        }
      } else {
        categoryList = level3Categories;
      }
      console.log(`\n📋 Processing unprocessed items: ${categoryList.length}`);
    } else if (choice === '2') {
      // Failed items only
      categoryList = level3Categories.filter(cat => failedIds.has(cat.ID));
      console.log(`\n📋 Processing failed items: ${categoryList.length}`);
    } else if (choice === '3') {
      // All items
      categoryList = level3Categories;
      console.log(`\n📋 Processing all items: ${categoryList.length}`);
    } else {
      console.log('❌ Invalid choice. Please select 1, 2, 3, 5, or 6.');
      continue;
    }

    if (categoryList.length === 0) {
      console.log('\n✅ No items to process!');
      continue;
    }

    // Process the selected categories
    await processCategories(categoryList, context, page);
  }
}

// Main function with menu loop
async function main() {
  let browser = null;
  let context = null;
  let page = null;

  try {
    // Connect to existing Chrome instance via CDP
    const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';

    console.log(`🔌 Attempting to connect to Chrome at ${CDP_URL}...`);

    browser = await chromium.connectOverCDP(CDP_URL);
    console.log('✅ Connected to Chrome via CDP\n');

    // Get the default context
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error('No browser contexts found');
    }
    context = contexts[0];

    // Get existing pages
    const pages = context.pages();
    console.log(`📑 Found ${pages.length} tab(s)`);

    // Find the admin page tab (if exists)
    let adminPage = null;
    for (const p of pages) {
      const url = p.url();
      if (url.includes('tmg4696.mycafe24.com')) {
        adminPage = p;
        break;
      }
    }

    // Close all other tabs (including data:/ tab)
    for (const p of pages) {
      if (p !== adminPage) {
        await p.close();
      }
    }

    // Use admin page or create new one
    if (adminPage) {
      page = adminPage;
      console.log('✅ Using existing admin tab\n');
    } else {
      page = await context.newPage();
      console.log('✅ Created new tab\n');
    }

    // Login to site (handles navigation, login check, and login if needed)
    const result = await loginToSite(page);
    page = result.page;

  } catch (error) {
    console.error('❌ Failed to connect to Chrome via CDP');
    console.error(`Error: ${error.message}\n`);
    console.log('📋 Please follow these steps:');
    console.log('1. Run: npm run process');
    console.log('2. Wait for Chrome to open');
    console.log('3. Check that Chrome shows extensions are loaded');
    console.log('4. Then run this script again\n');
    process.exit(1);
  }

  while (true) {
    const choice = await showMainMenu();

    if (choice === '5') {
      console.log('\n👋 Exiting...');
      if (browser) {
        await browser.close();
      }
      process.exit(0);
    }

    if (choice === '1') {
      try {
        // Navigate to bulk product collection page and process
        await navigateToBulkCollection(browser, context, page);
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
      continue;
    }

    if (choice === '2') {
      try {
        // Navigate to category management page
        await navigateToCategoryManagement(page);

        await categoryMappingMenu(browser, context, page);
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
      continue;
    }

    if (choice === '3') {
      try {
        // Modify collection conditions
        await modifyCollectionConditions(page);
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
      continue;
    }

    if (choice === '4') {
      try {
        // Open Gmail tabs for sending distribution channel confirmation emails
        const gmailPages = await openGmailTabs(context);

        if (gmailPages.length > 0) {
          // Extract Coupang distribution requests
          const results = await extractCoupangDistributionRequests(gmailPages);

          // Save results to CSV
          if (results.length > 0) {
            saveCoupangDistributionResults(results);
          }
        }
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
      continue;
    }

    console.log('❌ Invalid choice. Please select 1, 2, 3, 4, or 5.');
  }
}

// Run the main function
main();
