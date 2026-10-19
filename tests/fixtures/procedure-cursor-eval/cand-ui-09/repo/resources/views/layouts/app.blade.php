<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $title ?? 'Billing' }}</title>
    @vite('resources/css/app.css')
</head>
<body>
    <main>{{ $slot }}</main>
</body>
</html>
