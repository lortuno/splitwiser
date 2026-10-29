<?php

declare(strict_types=1);

namespace App\Dto;

/** What the user owes and is owed on one open group, with the transfers behind it. */
final readonly class GroupDebts implements \JsonSerializable
{
    /** @param list<DebtTransfer> $transfers */
    public function __construct(
        public int $tripId,
        public int $oweCents,
        public int $owedCents,
        public array $transfers,
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'trip_id' => $this->tripId,
            'owe_cents' => $this->oweCents,
            'owed_cents' => $this->owedCents,
            'transfers' => $this->transfers,
        ];
    }
}
