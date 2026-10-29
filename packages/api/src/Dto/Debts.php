<?php

declare(strict_types=1);

namespace App\Dto;

/** GET /me/debts: the user's totals over their open groups, never netted, and the groups behind them. */
final readonly class Debts implements \JsonSerializable
{
    /** @param list<GroupDebts> $groups */
    public function __construct(
        public int $oweCents,
        public int $owedCents,
        public array $groups,
    ) {
    }

    public function jsonSerialize(): array
    {
        return ['owe_cents' => $this->oweCents, 'owed_cents' => $this->owedCents, 'groups' => $this->groups];
    }
}
