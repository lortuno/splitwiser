<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\User;
use App\Repository\TripRepository;

/** Who may open a trip: only users linked to one of its members. 404 is checked before 403. */
final readonly class TripAccess
{
    public function __construct(private TripRepository $trips)
    {
    }

    /** @return int the user's person id on the group */
    public function personFor(int $tripId, User $user): int
    {
        if (!$this->trips->exists($tripId)) {
            throw new NotFoundException("Trip {$tripId} not found.");
        }

        return $this->trips->personForUser($tripId, $user->id)
            ?? throw new ForbiddenException('You are not a member of this group.');
    }
}
