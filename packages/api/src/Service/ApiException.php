<?php

declare(strict_types=1);

namespace App\Service;

/** An error answered as { error: { code, message, params? } } with its own status: 403, 429 or 503 of feature 8. */
final class ApiException extends \RuntimeException
{
    /** @param array<string, int> $params the numbers in the message, for the app's own wording */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $params = [],
    ) {
        parent::__construct($message);
    }

    public static function unverified(int $codeMinutes, int $resendInSeconds): self
    {
        return new self(403, 'unverified', 'Confirm your email first.', ['code_minutes' => $codeMinutes, 'resend_in_seconds' => $resendInSeconds]);
    }

    public static function locked(int $minutes): self
    {
        return new self(429, 'locked', "Too many attempts. Try again in {$minutes} minutes.", ['minutes' => $minutes]);
    }

    public static function tooSoon(int $seconds): self
    {
        return new self(429, 'too_soon', "Wait {$seconds} seconds before asking for a new code.", ['seconds' => $seconds]);
    }

    public static function tooManyRequests(): self
    {
        return new self(429, 'too_many_requests', 'Too many requests. Try again later.');
    }

    public static function mailUnavailable(): self
    {
        return new self(503, 'mail_unavailable', 'We could not send the email. Try again in a moment.');
    }
}
