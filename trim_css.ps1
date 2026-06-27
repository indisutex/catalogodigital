$file = 'src\pages\MenuDigital.css'
$lines = Get-Content $file
$lines[0..1114] | Set-Content $file
