Write-Host "Closing existing Chrome instances..." -ForegroundColor Yellow
taskkill /F /IM chrome.exe 2>$null
Start-Sleep -Seconds 3

Write-Host "`nStarting Chrome with Remote Debugging on port 9223..." -ForegroundColor Cyan
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9223", "--user-data-dir=$env:LOCALAPPDATA\Google\Chrome\User Data", "--no-first-run", "--no-default-browser-check"

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
