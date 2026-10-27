<?php

declare(strict_types=1);

namespace App\Dto;

/** One validated "split between" input: who bears the cost and the raw split value (see expense_splits). */
final readonly class SplitEntry
{
    public function __construct(
        public int $personId,
        public ?int $value,
    ) {
    }
}
