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
    console.log('3. 닫기');
    console.log('='.repeat(60));

    rl.question('선택하세요 (1-3): ', (answer) => {
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
      // Fill URL search input
      console.log('🔍 Entering URL...');
      const urlInput = page.locator('input[placeholder*="데이터를 수집하실 검색페이지"]');
      await urlInput.fill(url);

      // Click URL search button and handle new tab/popup
      console.log('🔎 Clicking search button...');

      // Listen for new pages/tabs
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
        page.locator('text=URL 상품검색하기').click()
      ]);

      // If a new tab was opened, close it and stay on current page
      if (newPage) {
        console.log('📑 New tab detected, closing it...');
        await newPage.close();
        console.log('✅ Staying on current tab');
      }

      // Wait for search results to load
      console.log('⏳ Waiting for search results...');
      await page.waitForTimeout(3000);

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

      // Wait for popup to close and check completion message
      console.log('⏳ Waiting for save completion...');
      await page.waitForTimeout(5000);

      // Check for completion message in layer_page div
      const completionMessage = await page.locator('#layer_page').textContent().catch(() => '');
      if (completionMessage.includes('신규상품의 저장이 완료되었습니다')) {
        console.log('✅ Save completed successfully!');
      } else {
        console.log('⚠️ Completion message not found, but continuing...');
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
  let isLoggedIn = false;

  // Auto login function
  async function ensureLoggedIn() {
    if (!isLoggedIn) {
      console.log('🔐 Auto-login starting...');
      try {
        if (!browser) {
          // Connect to existing Chrome instance via CDP
          const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';

          console.log(`🔌 Attempting to connect to Chrome at ${CDP_URL}...`);

          try {
            browser = await chromium.connectOverCDP(CDP_URL);
            console.log('✅ Connected to Chrome via CDP\n');

            // Get the default context
            const contexts = browser.contexts();
            if (contexts.length === 0) {
              throw new Error('No browser contexts found');
            }
            context = contexts[0];

            // Get existing pages or create new one
            const pages = context.pages();

            // Close extra tabs, keep only the first one
            if (pages.length > 1) {
              console.log(`📑 Found ${pages.length} tabs, closing extra tabs...`);
              for (let i = 1; i < pages.length; i++) {
                await pages[i].close();
              }
              console.log(`✅ Closed ${pages.length - 1} extra tab(s)\n`);
            }

            if (pages.length > 0) {
              page = pages[0];
              console.log('✅ Using existing Chrome tab\n');
            } else {
              page = await context.newPage();
              console.log('✅ Created new Chrome tab\n');
            }

            // Now login with the page
            const result = await loginToSite(page);
            page = result.page;
            isLoggedIn = true;
            console.log('✅ Login completed!\n');
            return;

          } catch (error) {
            console.error('❌ Failed to connect to Chrome via CDP');
            console.error(`Error: ${error.message}\n`);
            console.log('📋 Please follow these steps:');
            console.log('1. Run: start-chrome-debug.bat');
            console.log('2. Wait for Chrome to open');
            console.log('3. Check that Chrome shows extensions are loaded');
            console.log('4. Then run this script again\n');
            throw error;
          }
        }

        // This should not be reached
        const result = await loginToSite(page);
        context = result.context;
        page = result.page;
        isLoggedIn = true;
        console.log('✅ Login completed!\n');
      } catch (error) {
        console.error('❌ Login failed:', error.message);
        isLoggedIn = false;
        throw error;
      }
    }
  }

  while (true) {
    const choice = await showMainMenu();

    if (choice === '3') {
      console.log('\n👋 Exiting...');
      if (browser) {
        await browser.close();
      }
      process.exit(0);
    }

    if (choice === '1') {
      // Auto login if not logged in
      try {
        await ensureLoggedIn();

        // Navigate to bulk product collection page and process
        await navigateToBulkCollection(browser, context, page);
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
      continue;
    }

    if (choice === '2') {
      // Auto login if not logged in
      try {
        await ensureLoggedIn();

        // Navigate to category management page
        await navigateToCategoryManagement(page);

        await categoryMappingMenu(browser, context, page);
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
      continue;
    }

    console.log('❌ Invalid choice. Please select 1, 2, or 3.');
  }
}

// Run the main function
main();
