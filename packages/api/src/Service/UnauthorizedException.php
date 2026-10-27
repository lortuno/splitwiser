<?php

declare(strict_types=1);

namespace App\Service;

/** 401: no valid session (code "unauthenticated"), or wrong login details (code "invalid_credentials"). */
final class UnauthorizedException extends \RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }

    public static function unauthenticated(): self
    {
        return new self('unauthenticated', 'Please log in.');
    }

    public static function invalidCredentials(): self
    {
        return new self('invalid_credentials', 'Email or password is wrong.');
    }
}
