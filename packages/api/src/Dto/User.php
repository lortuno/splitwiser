<?php

declare(strict_types=1);

namespace App\Dto;

final readonly class User implements \JsonSerializable
{
    public function __construct(
        public int $id,
        public string $name,
        public string $email,
    ) {
    }

    public function jsonSerialize(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'email' => $this->email];
    }
}
