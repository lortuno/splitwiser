<?php

declare(strict_types=1);

namespace App\Service;

/** Input errors keyed by form field, each with a stable code (for future translation) and an English message. */
final class ValidationException extends \RuntimeException
{
    /** @param array<string, array{code: string, message: string}> $errors */
    public function __construct(public readonly array $errors)
    {
        parent::__construct('The expense is not valid.');
    }
}
