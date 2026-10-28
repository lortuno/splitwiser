<?php

declare(strict_types=1);

namespace App\Dto;

final readonly class Expense implements \JsonSerializable
{
    /**
     * @param list<Payer> $paidBy
     * @param list<SplitShare> $splitBetween
     */
    public function __construct(
        public int $id,
        public int $tripId,
        public string $name,
        public string $date,
        public int $amountCents,
        public SplitType $splitType,
        public Person $recordedBy,
        public array $paidBy,
        public array $splitBetween,
        public bool $edited = false,
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'id' => $this->id,
            'trip_id' => $this->tripId,
            'name' => $this->name,
            'date' => $this->date,
            'amount_cents' => $this->amountCents,
            'split_type' => $this->splitType->value,
            'recorded_by' => $this->recordedBy,
            'paid_by' => $this->paidBy,
            'split_between' => $this->splitBetween,
            'edited' => $this->edited,
        ];
    }
}
