<?php

declare(strict_types=1);

namespace App\Dto;

final readonly class Person implements \JsonSerializable
{
    public function __construct(
        public int $id,
        public string $name,
    ) {
    }

    public function jsonSerialize(): array
    {
        return ['id' => $this->id, 'name' => $this->name];
    }
}
