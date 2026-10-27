<?php

declare(strict_types=1);

namespace App\Dto;

/** One "paid by" entry of a stored expense. */
final readonly class Payer implements \JsonSerializable
{
    public function __construct(
        public int $personId,
        public string $name,
        public int $amountCents,
    ) {
    }

    public function jsonSerialize(): array
    {
        return ['person_id' => $this->personId, 'name' => $this->name, 'amount_cents' => $this->amountCents];
    }
}
