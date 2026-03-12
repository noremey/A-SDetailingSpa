<?php
require_once __DIR__ . '/config.php';
session_destroy();
jsonResponse(true, null, 'Berjaya log keluar');
