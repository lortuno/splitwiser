<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\Debts;
use App\Dto\DebtTransfer;
use App\Dto\GroupDebts;
use App\Dto\User;
use App\Repository\TripRepository;

/**
 * What a user owes and is owed: on each of their open groups, the suggested transfers ("Who owes whom") in which their
 * person pays or is paid. Paid groups count as settled. Groups without such a transfer are left out.
 */
final readonly class DebtService
{
    public function __construct(
        private TripRepository $trips,
        private SummaryService $summaries,
    ) {
    }

    public function forUser(User $user): Debts
    {
        $groups = [];
        $owe = 0;
        $owed = 0;
        foreach ($this->trips->findForUser($user->id) as $trip) {
            if ($trip->paid) {
                continue;
            }
            $me = $this->trips->personForUser($trip->id, $user->id);
            $transfers = [];
            $groupOwe = 0;
            $groupOwed = 0;
            foreach ($this->summaries->forTrip($trip->id)->transfers as $transfer) {
                if ($transfer->from->id === $me) {
                    $transfers[] = new DebtTransfer('pay', $transfer->to, $transfer->amountCents);
                    $groupOwe += $transfer->amountCents;
                } elseif ($transfer->to->id === $me) {
                    $transfers[] = new DebtTransfer('receive', $transfer->from, $transfer->amountCents);
                    $groupOwed += $transfer->amountCents;
                }
            }
            if ($transfers !== []) {
                $groups[] = new GroupDebts($trip->id, $groupOwe, $groupOwed, $transfers);
                $owe += $groupOwe;
                $owed += $groupOwed;
            }
        }

        return new Debts($owe, $owed, $groups);
    }
}
