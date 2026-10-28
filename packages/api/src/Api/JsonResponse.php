<?php

declare(strict_types=1);

namespace App\Api;

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
        // Bearer tokens, no cookies: any origin may call the API, and only a request carrying a token sees data.
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Content-Type: application/json; charset=utf-8');
        if ($this->status !== 204) {
            echo json_encode($this->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }
    }
}
