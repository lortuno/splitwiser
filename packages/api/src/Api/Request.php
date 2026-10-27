<?php

declare(strict_types=1);

namespace App\Api;

final readonly class Request
{
    public function __construct(
        public string $method,
        public string $path,
        public array $query,
        public string $body,
        public ?string $bearerToken = null,
    ) {
    }

    public static function fromGlobals(): self
    {
        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/') ?: '/',
            $_GET,
            (string) file_get_contents('php://input'),
            self::bearerTokenFrom(self::authorizationHeader()),
        );
    }

    /** The token from an "Authorization: Bearer {token}" header, or null. */
    public static function bearerTokenFrom(?string $header): ?string
    {
        return $header !== null && preg_match('/^Bearer\s+(\S+)$/i', trim($header), $m) === 1 ? $m[1] : null;
    }

    private static function authorizationHeader(): ?string
    {
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            return $_SERVER['HTTP_AUTHORIZATION'];
        }
        foreach (function_exists('getallheaders') ? getallheaders() : [] as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                return $value;
            }
        }

        return null;
    }

    /** @throws \JsonException */
    public function json(): array
    {
        $data = json_decode($this->body === '' ? '{}' : $this->body, true, 32, JSON_THROW_ON_ERROR);

        return is_array($data) ? $data : throw new \JsonException('Expected a JSON object.');
    }

    public function flag(string $name): bool
    {
        return in_array($this->query[$name] ?? null, ['1', 'true'], true);
    }
}
