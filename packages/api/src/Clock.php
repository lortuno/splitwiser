<?php

declare(strict_types=1);

namespace App;

/** The current time for every time-based security rule; the PHP tests move it instead of waiting. */
interface Clock
{
    public function now(): \DateTimeImmutable;
}
