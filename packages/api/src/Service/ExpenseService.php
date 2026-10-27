<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\Expense;
use App\Dto\Person;
use App\Dto\SplitShare;
use App\Repository\ExpenseRepository;
use App\Repository\TripRepository;
use PDO;

final readonly class ExpenseService
{
    public function __construct(
        private PDO $pdo,
        private TripRepository $trips,
        private ExpenseRepository $expenses,
        private ExpenseValidator $validator,
    ) {
    }

    /** @return list<Expense> */
    public function list(int $tripId): array
    {
        $this->memberIds($tripId);

        return $this->expenses->findByTrip($tripId);
    }

    public function create(int $tripId, array $input): Expense
    {
        $expense = $this->validator->validate($input, $this->memberIds($tripId));

        $this->pdo->beginTransaction();
        try {
            $expenseId = $this->expenses->insert($tripId, $expense);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return $this->expenses->find($expenseId);
    }

    /**
     * Calculates the split for an expense without saving it: the rows are written inside a
     * transaction, read back through v_expense_shares and rolled back, so the preview uses
     * exactly the same calculation as stored expenses.
     *
     * @return list<SplitShare>
     */
    public function preview(int $tripId, array $input): array
    {
        $expense = $this->validator->validate($input, $this->memberIds($tripId));

        $this->pdo->beginTransaction();
        try {
            $expenseId = $this->expenses->insert($tripId, $expense);
            return $this->expenses->find($expenseId)->splitBetween;
        } finally {
            $this->pdo->rollBack();
        }
    }

    /** @return list<int> */
    private function memberIds(int $tripId): array
    {
        $trip = $this->trips->find($tripId) ?? throw new NotFoundException("Trip {$tripId} not found.");

        return array_map(static fn (Person $p): int => $p->id, $trip->members);
    }
}
