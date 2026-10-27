<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\TripSummary;
use App\Repository\BalanceRepository;
use App\Repository\TripRepository;

final readonly class SummaryService
{
    public function __construct(
        private TripRepository $trips,
        private BalanceRepository $balances,
        private SettlementService $settlement,
    ) {
    }

    public function forTrip(int $tripId): TripSummary
    {
        if ($this->trips->find($tripId) === null) {
            throw new NotFoundException("Trip {$tripId} not found.");
        }
        $totals = $this->trips->totals($tripId);
        $balances = $this->balances->findByTrip($tripId);

        return new TripSummary(
            $tripId,
            $totals['total_cents'],
            $totals['expense_count'],
            $balances,
            $this->settlement->settle($balances),
        );
    }
}
