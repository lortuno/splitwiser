<?php

declare(strict_types=1);

namespace App\Dto;

/** Who marked a trip as paid (their person on the trip) and when, as "YYYY-MM-DDTHH:MM:SSZ" (UTC). */
final readonly class TripPaid implements \JsonSerializable
{
    public function __construct(
        public Person $by,
        public string $at,
    ) {
    }

    public function jsonSerialize(): array
    {
        return ['by' => $this->by, 'at' => $this->at];
    }
}
