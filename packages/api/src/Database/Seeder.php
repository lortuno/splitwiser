<?php

declare(strict_types=1);

namespace App\Database;

use App\Repository\PersonRepository;
use App\Repository\TripRepository;
use App\Service\ExpenseService;
use PDO;

/**
 * Deterministic demo data: one trip, four people, twenty expenses over seven days.
 * Expenses go through ExpenseService, so the seed obeys the same validation as the app.
 */
final readonly class Seeder
{
    public const string TRIP_NAME = 'Lisbon & Porto';
    public const array PEOPLE = ['Ana', 'Ben', 'Chloé', 'David'];

    public function __construct(
        private PDO $pdo,
        private TripRepository $trips,
        private PersonRepository $people,
        private ExpenseService $expenses,
    ) {
    }

    public function seedIfEmpty(): bool
    {
        if ($this->trips->count() > 0) {
            return false;
        }
        $this->seed();

        return true;
    }

    public function seed(): int
    {
        $this->pdo->beginTransaction();
        $tripId = $this->trips->create(self::TRIP_NAME, '2026-06-01', '2026-06-07');
        $ids = [];
        foreach (self::PEOPLE as $name) {
            $ids[$name] = $this->people->create($name);
            $this->trips->addMember($tripId, $ids[$name]);
        }
        $this->pdo->commit();

        foreach (self::expenses() as [$date, $name, $amount, $recordedBy, $paidBy, $type, $between]) {
            $this->expenses->create($tripId, [
                'name' => $name,
                'date' => $date,
                'amount_cents' => $amount,
                'recorded_by' => $ids[$recordedBy],
                'paid_by' => array_map(
                    static fn (string $person, int $cents): array => ['person_id' => $ids[$person], 'amount_cents' => $cents],
                    array_keys($paidBy),
                    $paidBy,
                ),
                'split' => [
                    'type' => $type,
                    'between' => array_map(
                        static fn (string $person, ?int $value): array => ['person_id' => $ids[$person], 'value' => $value],
                        array_keys($between),
                        $between,
                    ),
                ],
            ]);
        }

        return $tripId;
    }

    /**
     * [date, name, amount cents, recorded by, paid by (person => cents), split type, split between (person => value)]
     * Split values: null for equal, cents for exact, basis points for percentage, units for shares.
     */
    public static function expenses(): array
    {
        $all = ['Ana' => null, 'Ben' => null, 'Chloé' => null, 'David' => null];

        return [
            ['2026-06-01', 'Airport taxi to Alfama', 3480, 'Ana', ['Ana' => 3480], 'equal', $all],
            ['2026-06-01', 'Pastéis de Belém breakfast', 1870, 'Ben', ['Chloé' => 1870], 'equal', $all],
            ['2026-06-01', 'Dinner at the harbour', 14260, 'David', ['Ben' => 8000, 'David' => 6260], 'equal', $all],
            ['2026-06-02', 'Tram 28 tickets', 1200, 'Ana', ['Ana' => 1200], 'equal', $all],
            ['2026-06-02', 'Museum tickets', 4500, 'Chloé', ['David' => 4500], 'exact', ['Ana' => 1500, 'Ben' => 1500, 'Chloé' => 1500]],
            ['2026-06-02', 'Groceries at Pingo Doce', 6743, 'Ben', ['Ben' => 6743], 'shares', ['Ana' => 1, 'Ben' => 2, 'Chloé' => 1, 'David' => 2]],
            ['2026-06-03', 'Train to Sintra', 3240, 'Ana', ['Ana' => 3240], 'equal', $all],
            ['2026-06-03', 'Pena Palace tickets', 8000, 'Ben', ['Ana' => 4000, 'Chloé' => 4000], 'equal', $all],
            ['2026-06-03', 'Azulejo tile souvenir', 2490, 'Chloé', ['Chloé' => 2490], 'equal', ['Chloé' => null]],
            ['2026-06-04', 'Train to Porto', 11960, 'David', ['David' => 11960], 'equal', $all],
            ['2026-06-04', 'Airbnb Porto, 3 nights', 54000, 'Ana', ['Ana' => 30000, 'Ben' => 24000], 'percentage', ['Ana' => 3000, 'Ben' => 3000, 'Chloé' => 2000, 'David' => 2000]],
            ['2026-06-04', 'Fado night drinks', 10000, 'Chloé', ['Ben' => 10000], 'equal', ['Ana' => null, 'Ben' => null, 'David' => null]],
            ['2026-06-05', 'Port wine tasting', 9600, 'David', ['Chloé' => 4800, 'David' => 4800], 'shares', ['Ana' => 2, 'Ben' => 1, 'Chloé' => 2, 'David' => 1]],
            ['2026-06-05', 'Livraria Lello entrance', 2000, 'Ana', ['Ben' => 2000], 'exact', ['Ben' => 1000, 'Chloé' => 1000]],
            ['2026-06-05', 'Francesinha lunch', 6185, 'Ben', ['David' => 6185], 'exact', ['Ana' => 1450, 'Ben' => 1595, 'Chloé' => 1520, 'David' => 1620]],
            ['2026-06-06', 'Douro valley boat tour', 26000, 'Chloé', ['Chloé' => 26000], 'percentage', ['Ana' => 2500, 'Ben' => 2500, 'Chloé' => 2500, 'David' => 2500]],
            ['2026-06-06', 'Sunscreen and pharmacy', 1399, 'David', ['David' => 1399], 'percentage', ['Ana' => 3333, 'Ben' => 3333, 'David' => 3334]],
            ['2026-06-06', 'Seafood dinner in Matosinhos', 18840, 'Ana', ['Ben' => 10000, 'Chloé' => 8840], 'equal', $all],
            ['2026-06-07', 'Metro day passes', 2640, 'Ben', ['Ana' => 2640], 'equal', $all],
            ['2026-06-07', 'Taxi to Porto airport', 3150, 'Chloé', ['David' => 3150], 'shares', ['Ana' => 1, 'Ben' => 1, 'Chloé' => 1, 'David' => 1]],
        ];
    }
}
