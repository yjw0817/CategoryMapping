Write-Host "Checking for existing Chrome with debugging on port 9223..." -ForegroundColor Yellow

# Check if Chrome with debugging is already running
try {
    $result = Invoke-RestMethod -Uri http://127.0.0.1:9223/json/version -ErrorAction Stop
    Write-Host "Chrome is already running with remote debugging on port 9223." -ForegroundColor Green
    Write-Host "Browser: $($result.Browser)" -ForegroundColor Green
    Write-Host "Skipping Chrome launch." -ForegroundColor Cyan
    Write-Host "`nChrome is ready for automation!" -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "No Chrome found on port 9223. Starting new instance..." -ForegroundColor Yellow
}

Write-Host "`nStarting Chrome with Remote Debugging on port 9223..." -ForegroundColor Cyan
Write-Host "Opening login page..." -ForegroundColor Yellow
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9223", "--user-data-dir=$env:LOCALAPPDATA\Google\Chrome\User Data", "--no-first-run", "--no-default-browser-check", "--disable-default-apps", "https://tmg4696.mycafe24.com/mall/admin/admin.php"

Write-Host "Waiting for Chrome to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

Write-Host "`nTesting connection..." -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri http://127.0.0.1:9223/json/version
    Write-Host "SUCCESS! Chrome is running with remote debugging enabled." -ForegroundColor Green
    Write-Host "Browser: $($result.Browser)" -ForegroundColor Green
    Write-Host "Extensions should be loaded from your regular profile." -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not connect to Chrome debugging port." -ForegroundColor Red
    Write-Host "Please check if Chrome opened successfully." -ForegroundColor Red
}

Write-Host "`nChrome is ready for automation!" -ForegroundColor Cyan
