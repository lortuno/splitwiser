<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\User;
use App\Repository\TripRepository;

/**
 * Marks a trip as paid once everyone has settled up outside the app, or reopens it. Any member may do either; who did
 * it and when is kept in trip_status_changes. A paid trip takes no new or edited expenses (ExpenseService).
 */
final readonly class TripStatusService
{
    public function __construct(private TripRepository $trips)
    {
    }

    public function markPaid(int $tripId, User $user): void
    {
        if ($this->trips->isPaid($tripId)) {
            throw ConflictException::alreadyPaid();
        }
        $this->trips->addStatusChange($tripId, 'paid', $user->id);
    }

    public function reopen(int $tripId, User $user): void
    {
        if (!$this->trips->isPaid($tripId)) {
            throw ConflictException::alreadyOpen();
        }
        $this->trips->addStatusChange($tripId, 'open', $user->id);
    }
}
