<?php

declare(strict_types=1);

namespace App\Dto;

final readonly class Balance implements \JsonSerializable
{
    public function __construct(
        public int $personId,
        public string $name,
        public int $paidCents,
        public int $shareCents,
        public int $netCents,
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'person_id' => $this->personId,
            'name' => $this->name,
            'paid_cents' => $this->paidCents,
            'share_cents' => $this->shareCents,
            'net_cents' => $this->netCents,
        ];
    }
}
