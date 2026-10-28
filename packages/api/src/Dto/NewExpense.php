<?php

declare(strict_types=1);

namespace App\Dto;

/** A validated expense ready to be stored. */
final readonly class NewExpense
{
    /**
     * @param array<int, int> $paidBy person id => cents paid
     * @param list<SplitEntry> $splitBetween
     */
    public function __construct(
        public string $name,
        public string $date,
        public int $amountCents,
        public int $recordedBy,
        public array $paidBy,
        public SplitType $splitType,
        public array $splitBetween,
        /** null when the request sent none: the API decides (a guess for a new expense, unchanged for an edit). */
        public ?Category $category = null,
    ) {
    }
}
