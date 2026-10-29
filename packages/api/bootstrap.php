<?php

declare(strict_types=1);

// Composer's autoloader for the PHP dependencies (symfony/mailer), then a minimal PSR-4 autoloader for the app's own
// classes: App\Foo\Bar -> src/Foo/Bar.php.
require __DIR__ . '/vendor/autoload.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $file = __DIR__ . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) {
        require $file;
    }
});
