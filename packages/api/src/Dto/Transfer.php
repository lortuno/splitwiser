<?php

declare(strict_types=1);

namespace App\Dto;

/** "$from pays $to": a suggested settlement payment. */
final readonly class Transfer implements \JsonSerializable
{
    public function __construct(
        public Person $from,
        public Person $to,
        public int $amountCents,
    ) {
    }

    public function jsonSerialize(): array
    {
        return ['from' => $this->from, 'to' => $this->to, 'amount_cents' => $this->amountCents];
    }
}
