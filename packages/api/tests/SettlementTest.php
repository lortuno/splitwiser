<?php

declare(strict_types=1);

use App\Dto\Balance;
use App\Dto\Transfer;
use App\Service\SettlementService;

/** @param array<int, int> $nets person id => net cents */
function settle(array $nets): array
{
    $balances = [];
    foreach ($nets as $id => $net) {
        $balances[] = new Balance($id, "P{$id}", 0, 0, $net);
    }

    return (new SettlementService())->settle($balances);
}

/** Applies transfers to the nets and checks everyone ends at zero. */
function assertSettles(array $nets, array $transfers): void
{
    foreach ($transfers as $t) {
        assertTrue($t->amountCents > 0, 'Transfers must be positive.');
        $nets[$t->from->id] += $t->amountCents;
        $nets[$t->to->id] -= $t->amountCents;
    }
    assertSame(array_fill_keys(array_keys($nets), 0), $nets);
}

test('nothing to settle gives no transfers', function (): void {
    assertSame([], settle([1 => 0, 2 => 0]));
});

test('one debtor pays one creditor', function (): void {
    $transfers = settle([1 => 2500, 2 => -2500]);

    assertSame(1, count($transfers));
    assertSame([2, 1, 2500], [$transfers[0]->from->id, $transfers[0]->to->id, $transfers[0]->amountCents]);
});

test('pairs that cancel out are settled directly (fewer transfers than greedy)', function (): void {
    // Greedy largest-first would need 4 transfers; {4, -4} and {5, -2, -3} need 1 + 2.
    $nets = [1 => 500, 2 => 400, 3 => -200, 4 => -300, 5 => -400];
    $transfers = settle($nets);

    assertSame(3, count($transfers));
    assertSettles($nets, $transfers);
});

test('settlement is deterministic', function (): void {
    $nets = [1 => 1000, 2 => 1000, 3 => -1000, 4 => -1000];
    $describe = fn (array $ts) => array_map(fn (Transfer $t) => [$t->from->id, $t->to->id, $t->amountCents], $ts);

    assertSame($describe(settle($nets)), $describe(settle($nets)));
    assertSame([[3, 1, 1000], [4, 2, 1000]], $describe(settle($nets)));
});

test('n people with no cancelling subgroup need n - 1 transfers', function (): void {
    $nets = [1 => 700, 2 => 300, 3 => -450, 4 => -550];
    $transfers = settle($nets);

    assertSame(3, count($transfers));
    assertSettles($nets, $transfers);
});

test('large groups fall back to greedy and still settle', function (): void {
    $nets = [];
    for ($i = 1; $i <= 20; $i++) {
        $nets[$i] = $i % 2 === 0 ? $i * 100 : -($i + 1) * 100;
    }
    $nets[1] += -array_sum($nets);
    $transfers = settle($nets);

    assertTrue(count($transfers) <= 19, 'At most n - 1 transfers.');
    assertSettles($nets, $transfers);
});
