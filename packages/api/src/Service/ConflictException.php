<?php

declare(strict_types=1);

namespace App\Service;

/** 409: the request is valid, but the trip's status does not allow it. */
final class ConflictException extends \RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }

    public static function tripPaid(): self
    {
        return new self('trip_paid', 'This group is marked as paid. Reopen it to make changes.');
    }

    public static function alreadyPaid(): self
    {
        return new self('already_paid', 'This group is already marked as paid.');
    }

    public static function alreadyOpen(): self
    {
        return new self('already_open', 'This group is already open.');
    }
}
