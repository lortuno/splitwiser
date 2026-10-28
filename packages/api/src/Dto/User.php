<?php

declare(strict_types=1);

namespace App\Dto;

final readonly class User implements \JsonSerializable
{
    public function __construct(
        public int $id,
        public string $displayName,
        public string $email,
    ) {
    }

    public function jsonSerialize(): array
    {
        return ['id' => $this->id, 'display_name' => $this->displayName, 'email' => $this->email];
    }
}
