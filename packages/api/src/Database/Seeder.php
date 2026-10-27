<?php

declare(strict_types=1);

namespace App\Database;

use App\Repository\PersonRepository;
use App\Repository\TripRepository;
use App\Repository\UserRepository;
use App\Service\ExpenseService;
use PDO;

/**
 * Deterministic demo data: the demo accounts in ACCOUNTS, one trip with four people and twenty expenses over
 * seven days, followed by the edge-case trips in fixtures().
 * Expenses go through ExpenseService, so the seed obeys the same validation as the app.
 * A seeded person whose name is in ACCOUNTS is linked to that account, on every trip they are on.
 */
final readonly class Seeder
{
    public const string TRIP_NAME = 'Lisbon & Porto';
    public const array PEOPLE = ['Ana', 'Ben', 'Chloé', 'David'];
    public const string DEMO_PASSWORD = 'travel-demo-2026';
    /** Demo accounts, person name => email. Everyone else in the seed has no account. */
    public const array ACCOUNTS = [
        'Ana' => 'ana@example.com',
        'Ben' => 'ben@example.com',
        'Chloé' => 'chloe@example.com',
        'David' => 'david@example.com',
        'Eva' => 'eva@example.com',
        'Hugo' => 'hugo@example.com',
        'Jon' => 'jon@example.com',
        'Noah' => 'noah@example.com',
        'Olga' => 'olga@example.com',
    ];

    public function __construct(
        private PDO $pdo,
        private TripRepository $trips,
        private PersonRepository $people,
        private UserRepository $users,
        private ExpenseService $expenses,
    ) {
    }

    public function seedIfEmpty(): bool
    {
        if ($this->trips->count() > 0) {
            return false;
        }
        $this->seedAccounts();
        $this->seed();
        $this->seedFixtures();

        return true;
    }

    public function seedAccounts(): void
    {
        foreach (self::ACCOUNTS as $name => $email) {
            $this->users->create($name, $email, self::demoPasswordHash());
        }
    }

    public function seed(): int
    {
        return $this->seedTrip(self::TRIP_NAME, '2026-06-01', '2026-06-07', self::PEOPLE, self::expenses());
    }

    /**
     * Edge-case trips for the acceptance checks in specs/01-trip-at-a-glance-specification.md (trips 2–6) and
     * specs/02-login-and-my-trips-specification.md (trip 7), created after the demo trip so it keeps id 1.
     * @return list<int> trip ids in fixtures() order
     */
    public function seedFixtures(): array
    {
        return array_map(
            fn (array $trip): int => $this->seedTrip(...$trip),
            self::fixtures(),
        );
    }

    /**
     * @param list<string> $people
     * @param list<array> $expenses rows shaped like expenses()
     */
    private function seedTrip(string $tripName, string $startDate, string $endDate, array $people, array $expenses): int
    {
        $this->pdo->beginTransaction();
        $tripId = $this->trips->create($tripName, $startDate, $endDate);
        $ids = [];
        foreach ($people as $name) {
            $userId = isset(self::ACCOUNTS[$name]) ? $this->users->idByEmail(self::ACCOUNTS[$name]) : null;
            $ids[$name] = $this->people->create($name, $userId);
            $this->trips->addMember($tripId, $ids[$name]);
        }
        $this->pdo->commit();

        foreach ($expenses as [$date, $name, $amount, $recordedBy, $paidBy, $type, $between]) {
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

    /** [trip name, start date, end date, people, expenses shaped like expenses()] */
    public static function fixtures(): array
    {
        $max = 'Maximiliane Alexandra von Hohenzollern-Sigmaringen';
        $group = ['Olga' => null, 'Paul' => null, 'Quinn' => null, 'Rosa' => null, 'Sam' => null, 'Tara' => null];

        return [
            ['Empty weekend', '2026-01-10', '2026-01-12', ['Eva', 'Finn', 'Greta'], []],
            ['Even split', '2026-02-01', '2026-02-02', ['Hugo', 'Iris'], [
                ['2026-02-01', 'Lunch', 4000, 'Hugo', ['Hugo' => 4000], 'equal', ['Hugo' => null, 'Iris' => null]],
                ['2026-02-02', 'Dinner', 4000, 'Iris', ['Iris' => 4000], 'equal', ['Hugo' => null, 'Iris' => null]],
            ]],
            ['Three-way taxi', '2026-03-05', '2026-03-05', ['Jon', 'Kim', 'Lea'], [
                ['2026-03-05', 'Taxi', 1000, 'Jon', ['Jon' => 1000], 'equal', ['Jon' => null, 'Kim' => null, 'Lea' => null]],
            ]],
            ['Great tour of every UNESCO world heritage site in southern Europe by sleeper train', '2026-04-01', '2026-04-30', [$max, 'Noah'], [
                ['2026-04-01', 'Private jet charter', 100_000_000, 'Noah', ['Noah' => 100_000_000], 'equal', [$max => null, 'Noah' => null]],
                ['2026-04-02', 'Yacht week', 100_000_000, 'Noah', ['Noah' => 100_000_000], 'equal', [$max => null, 'Noah' => null]],
                ['2026-04-03', 'Overnight sleeper train from Lisbon to Madrid with a private compartment, breakfast, late checkout, and luggage storage.', 34_567_891, 'Noah', ['Noah' => 34_567_891], 'equal', [$max => null, 'Noah' => null]],
            ]],
            ['Big group', '2026-05-01', '2026-05-03', array_keys($group), [
                ['2026-05-01', 'Group dinner', 6000, 'Olga', ['Olga' => 6000], 'equal', $group],
                ['2026-05-02', 'Boat tickets', 3000, 'Paul', ['Paul' => 3000], 'equal', ['Paul' => null, 'Quinn' => null, 'Rosa' => null]],
            ]],
            // Only Ana and Chloé: their lists show two trips, Ben's and David's only one.
            ['Madrid weekend', '2026-09-12', '2026-09-14', ['Ana', 'Chloé'], [
                ['2026-09-12', 'Tapas at Mercado de San Miguel', 4830, 'Chloé', ['Chloé' => 4830], 'equal', ['Ana' => null, 'Chloé' => null]],
                ['2026-09-13', 'Prado Museum tickets', 3000, 'Ana', ['Ana' => 3000], 'equal', ['Ana' => null, 'Chloé' => null]],
            ]],
        ];
    }

    /** Hashed once per process: bcrypt is slow on purpose, and every demo account shares the password. */
    private static function demoPasswordHash(): string
    {
        static $hash = null;

        return $hash ??= password_hash(self::DEMO_PASSWORD, PASSWORD_DEFAULT);
    }
}
