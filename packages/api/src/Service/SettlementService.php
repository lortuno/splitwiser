<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\Balance;
use App\Dto\Person;
use App\Dto\Transfer;

/**
 * Suggests who pays whom so that every net balance reaches zero with the fewest transfers.
 *
 * A group of k people whose balances sum to zero can always be settled with k - 1 transfers,
 * so the minimum is (people with a non-zero balance) - (largest number of disjoint zero-sum groups).
 * Up to MAX_EXACT_PEOPLE people the groups are found exactly with a bitmask search (O(n * 2^n));
 * above that the greedy settlement is used on everyone at once (at most n - 1 transfers).
 * Inside each group: largest debtor pays largest creditor; ties go to the lower person id.
 */
final class SettlementService
{
    public const int MAX_EXACT_PEOPLE = 15;

    /**
     * @param list<Balance> $balances
     * @return list<Transfer>
     */
    public function settle(array $balances): array
    {
        $open = array_values(array_filter($balances, static fn (Balance $b): bool => $b->netCents !== 0));
        usort($open, static fn (Balance $a, Balance $b): int => $a->personId <=> $b->personId);

        $groups = count($open) <= self::MAX_EXACT_PEOPLE ? $this->zeroSumGroups($open) : [$open];

        $transfers = [];
        foreach ($groups as $group) {
            array_push($transfers, ...$this->settleGreedily($group));
        }

        return $transfers;
    }

    /**
     * Splits the balances into as many disjoint zero-sum groups as possible.
     *
     * best[mask] = max number of zero-sum "prefixes" when the people in mask are removed one by
     * one; following the best removal order back from the full set and cutting wherever the
     * remaining set sums to zero yields the groups.
     *
     * @param list<Balance> $balances
     * @return list<list<Balance>>
     */
    private function zeroSumGroups(array $balances): array
    {
        $n = count($balances);
        if ($n === 0) {
            return [];
        }
        $full = (1 << $n) - 1;

        $sum = array_fill(0, $full + 1, 0);
        $best = array_fill(0, $full + 1, 0);
        for ($mask = 1; $mask <= $full; $mask++) {
            $low = $mask & -$mask;
            $sum[$mask] = $sum[$mask ^ $low] + $balances[strlen(decbin($low)) - 1]->netCents;
            $max = 0;
            for ($i = 0; $i < $n; $i++) {
                if (($mask >> $i) & 1) {
                    $max = max($max, $best[$mask ^ (1 << $i)]);
                }
            }
            $best[$mask] = $max + ($sum[$mask] === 0 ? 1 : 0);
        }

        $groups = [];
        $current = [];
        $mask = $full;
        while ($mask !== 0) {
            $target = $best[$mask] - ($sum[$mask] === 0 ? 1 : 0);
            for ($i = 0; $i < $n; $i++) {
                if ((($mask >> $i) & 1) && $best[$mask ^ (1 << $i)] === $target) {
                    break;
                }
            }
            $current[] = $balances[$i];
            $mask ^= 1 << $i;
            if ($sum[$mask] === 0) {
                usort($current, static fn (Balance $a, Balance $b): int => $a->personId <=> $b->personId);
                $groups[] = $current;
                $current = [];
            }
        }
        usort($groups, static fn (array $a, array $b): int => $a[0]->personId <=> $b[0]->personId);

        return $groups;
    }

    /**
     * @param list<Balance> $group balances summing to zero
     * @return list<Transfer>
     */
    private function settleGreedily(array $group): array
    {
        $debtors = [];
        $creditors = [];
        $people = [];
        foreach ($group as $balance) {
            $people[$balance->personId] = new Person($balance->personId, $balance->name);
            if ($balance->netCents < 0) {
                $debtors[$balance->personId] = -$balance->netCents;
            } else {
                $creditors[$balance->personId] = $balance->netCents;
            }
        }

        $transfers = [];
        while ($debtors !== [] && $creditors !== []) {
            $debtor = $this->largest($debtors);
            $creditor = $this->largest($creditors);
            $amount = min($debtors[$debtor], $creditors[$creditor]);
            $transfers[] = new Transfer($people[$debtor], $people[$creditor], $amount);

            $debtors[$debtor] -= $amount;
            $creditors[$creditor] -= $amount;
            if ($debtors[$debtor] === 0) {
                unset($debtors[$debtor]);
            }
            if ($creditors[$creditor] === 0) {
                unset($creditors[$creditor]);
            }
        }

        return $transfers;
    }

    /** @param array<int, int> $amounts person id => cents */
    private function largest(array $amounts): int
    {
        $bestId = null;
        foreach ($amounts as $personId => $cents) {
            if ($bestId === null || $cents > $amounts[$bestId] || ($cents === $amounts[$bestId] && $personId < $bestId)) {
                $bestId = $personId;
            }
        }

        return $bestId;
    }
}
