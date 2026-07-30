<?php
// SPA Fallback for Hostinger PHP/Apache/LiteSpeed
$file = __DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (is_file($file)) {
    return false;
}
require __DIR__ . '/index.html';
