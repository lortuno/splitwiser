<?php

declare(strict_types=1);

namespace App\Dto;

/** One "split between" entry with its calculated share (from v_expense_shares). */
final readonly class SplitShare implements \JsonSerializable
{
    public function __construct(
        public int $personId,
        public string $name,
        public ?int $splitValue,
        public int $shareCents,
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'person_id' => $this->personId,
            'name' => $this->name,
            'split_value' => $this->splitValue,
            'share_cents' => $this->shareCents,
        ];
    }
}
