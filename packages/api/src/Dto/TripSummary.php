<?php

declare(strict_types=1);

namespace App\Dto;

use App\Money;

final readonly class TripSummary implements \JsonSerializable
{
    /**
     * @param list<Balance> $balances
     * @param list<Transfer> $transfers
     */
    public function __construct(
        public int $tripId,
        public int $totalCents,
        public int $expenseCount,
        public array $balances,
        public array $transfers,
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'trip_id' => $this->tripId,
            'currency' => Money::CURRENCY,
            'total_cents' => $this->totalCents,
            'expense_count' => $this->expenseCount,
            'balances' => $this->balances,
            'transfers' => $this->transfers,
        ];
    }
}
