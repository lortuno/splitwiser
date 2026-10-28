<?php

declare(strict_types=1);

namespace App\Dto;

final readonly class Trip implements \JsonSerializable
{
    /** @param list<Person>|null $members null when members were not loaded */
    public function __construct(
        public int $id,
        public string $name,
        public string $startDate,
        public string $endDate,
        public int $totalCents,
        public bool $paid = false,
        public ?array $members = null,
    ) {
    }

    public function jsonSerialize(): array
    {
        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'start_date' => $this->startDate,
            'end_date' => $this->endDate,
            'total_cents' => $this->totalCents,
            'paid' => $this->paid,
        ];
        if ($this->members !== null) {
            $data['members'] = $this->members;
        }

        return $data;
    }
}
