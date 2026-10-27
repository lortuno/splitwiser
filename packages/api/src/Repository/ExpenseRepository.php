<?php

declare(strict_types=1);

namespace App\Repository;

use App\Dto\Expense;
use App\Dto\NewExpense;
use App\Dto\Payer;
use App\Dto\Person;
use App\Dto\SplitShare;
use App\Dto\SplitType;
use PDO;

final readonly class ExpenseRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** Writes the input rows only; shares are derived by v_expense_shares. Call inside a transaction. */
    public function insert(int $tripId, NewExpense $expense): int
    {
        $this->pdo->prepare(
            'INSERT INTO expenses (trip_id, name, spent_on, amount_cents, recorded_by, split_type)
             VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([
            $tripId,
            $expense->name,
            $expense->date,
            $expense->amountCents,
            $expense->recordedBy,
            $expense->splitType->value,
        ]);
        $expenseId = (int) $this->pdo->lastInsertId();

        $payer = $this->pdo->prepare('INSERT INTO expense_payers (expense_id, person_id, amount_cents) VALUES (?, ?, ?)');
        foreach ($expense->paidBy as $personId => $amountCents) {
            $payer->execute([$expenseId, $personId, $amountCents]);
        }

        $split = $this->pdo->prepare('INSERT INTO expense_splits (expense_id, person_id, split_value) VALUES (?, ?, ?)');
        foreach ($expense->splitBetween as $entry) {
            $split->execute([$expenseId, $entry->personId, $entry->value]);
        }

        return $expenseId;
    }

    /** @return list<Expense> newest first */
    public function findByTrip(int $tripId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM v_expense_list WHERE trip_id = ? ORDER BY spent_on DESC, id DESC'
        );
        $stmt->execute([$tripId]);

        return array_map(fn (array $row): Expense => $this->toExpense($row), $stmt->fetchAll());
    }

    public function find(int $expenseId): ?Expense
    {
        $stmt = $this->pdo->prepare('SELECT * FROM v_expense_list WHERE id = ?');
        $stmt->execute([$expenseId]);
        $row = $stmt->fetch();

        return $row === false ? null : $this->toExpense($row);
    }

    private function toExpense(array $row): Expense
    {
        $paidBy = array_map(
            static fn (array $p): Payer => new Payer($p['person_id'], $p['name'], $p['amount_cents']),
            json_decode($row['paid_by_json'], true, flags: JSON_THROW_ON_ERROR),
        );
        $splitBetween = array_map(
            static fn (array $s): SplitShare => new SplitShare($s['person_id'], $s['name'], $s['split_value'], $s['share_cents']),
            json_decode($row['split_between_json'], true, flags: JSON_THROW_ON_ERROR),
        );

        return new Expense(
            (int) $row['id'],
            (int) $row['trip_id'],
            $row['name'],
            $row['spent_on'],
            (int) $row['amount_cents'],
            SplitType::from($row['split_type']),
            new Person((int) $row['recorded_by'], $row['recorded_by_name']),
            $paidBy,
            $splitBetween,
        );
    }
}
