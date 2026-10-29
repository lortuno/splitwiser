<?php

declare(strict_types=1);

namespace App\Api;

use App\Settings;

final readonly class JsonResponse
{
    public function __construct(
        public int $status,
        public mixed $data = null,
    ) {
    }

    public function send(): void
    {
        http_response_code($this->status);
        foreach (self::headers($_SERVER['HTTP_ORIGIN'] ?? null, Settings::fromEnvironment()->appOrigin) as $name => $value) {
            header("{$name}: {$value}");
        }
        if ($this->status !== 204) {
            echo json_encode($this->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }
    }

    /**
     * The headers of every response: CORS only for the app's own origin (native apps send no Origin and need none),
     * and the security headers of feature 8.
     * @return array<string, string>
     */
    public static function headers(?string $origin, string $appOrigin): array
    {
        return ($origin === $appOrigin ? ['Access-Control-Allow-Origin' => $appOrigin] : []) + [
            'Vary' => 'Origin',
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
            'Content-Type' => 'application/json; charset=utf-8',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'no-referrer',
            'Cache-Control' => 'no-store',
        ];
    }
}
