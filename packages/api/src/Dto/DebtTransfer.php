<?php

declare(strict_types=1);

namespace App\Dto;

/** One suggested transfer seen from the user's side: they "pay" $person, or $person pays them ("receive"). */
final readonly class DebtTransfer implements \JsonSerializable
{
    public function __construct(
        public string $direction,
        public Person $person,
        public int $amountCents,
    ) {
    }

    public function jsonSerialize(): array
    {
        return ['direction' => $this->direction, 'person' => $this->person, 'amount_cents' => $this->amountCents];
    }
}
