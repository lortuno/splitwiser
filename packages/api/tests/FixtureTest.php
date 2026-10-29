<?php

declare(strict_types=1);

use App\Api\Request;
use App\Api\Routes;
use App\Container;

// Pins the numbers the acceptance checks in specs/groups/01-group-at-a-glance-specification.md rely on,
// plus group 7 from specs/accounts/02-login-and-my-groups-specification.md.

/** A fresh database seeded exactly like `docker compose up`. */
function seededApp(?App\Clock $clock = null): Container
{
    $app = app($clock);
    $app->seeder()->seedIfEmpty();

    return $app;
}

/** @return list<string> "From pays To: cents" for each transfer, in API order */
function transfersOf(App\Dto\TripSummary $summary): array
{
    return array_map(fn ($t) => "{$t->from->name} pays {$t->to->name}: {$t->amountCents}", $summary->transfers);
}

/** Sends a request through the router, with a bearer token when one is given. */
function call(Container $app, string $method, string $path, array $body = [], ?string $token = null, array $query = []): App\Api\JsonResponse
{
    $json = $body === [] ? '' : json_encode($body, JSON_THROW_ON_ERROR);

    return Routes::build($app)->dispatch(new Request($method, $path, $query, $json, $token));
}

function get(Container $app, string $path, ?string $token = null): App\Api\JsonResponse
{
    return call($app, 'GET', $path, token: $token);
}

/** Logs in a seeded demo account and returns its token. */
function tokenFor(Container $app, string $email): string
{
    return $app->auth->logIn(['email' => $email, 'password' => App\Database\Seeder::DEMO_PASSWORD], '127.0.0.1')[0];
}

test('seeded trips have fixed ids', function (): void {
    $trips = seededApp()->trips->findAll();
    $names = array_map(fn ($t) => [$t->id, $t->name], $trips);
    sort($names);

    assertSame([
        [1, 'Lisbon & Porto'],
        [2, 'Empty weekend'],
        [3, 'Even split'],
        [4, 'Three-way taxi'],
        [5, 'Great tour of every UNESCO world heritage site in southern Europe by sleeper train'],
        [6, 'Big group'],
        [7, 'Madrid weekend'],
        [8, 'Ski week'],
    ], $names);
});

test('trip 1, demo trip: total and transfers', function (): void {
    $summary = seededApp()->summaries->forTrip(1);

    assertSame(191557, $summary->totalCents);
    assertSame(20, $summary->expenseCount);
    assertSame(['Ana pays Ben: 6375', 'David pays Ben: 2765', 'David pays Chloé: 2707'], transfersOf($summary));
    assertSame([1 => -6375, 2 => 9140, 3 => 2707, 4 => -5472], netsOf($summary));
});

test('trip 2, no expenses: zero total and no transfers', function (): void {
    $app = seededApp();
    $summary = $app->summaries->forTrip(2);

    assertSame(0, $summary->totalCents);
    assertSame(0, $summary->expenseCount);
    assertSame([], $summary->transfers);
    assertSame(3, count($app->trips->find(2)->members));
});

test('trip 3, everyone even: expenses but no transfers', function (): void {
    $summary = seededApp()->summaries->forTrip(3);

    assertSame(8000, $summary->totalCents);
    assertSame(2, $summary->expenseCount);
    assertSame([], $summary->transfers);
});

test('trip 4, 10,00 € split by three: leftover cent goes to the first person', function (): void {
    $app = seededApp();
    $summary = $app->summaries->forTrip(4);

    assertSame(1000, $summary->totalCents);
    assertSame(1, $summary->expenseCount);
    assertSame([334, 333, 333], array_values(sharesOf($app->expenses->list(4)[0])));
    assertSame(['Kim pays Jon: 333', 'Lea pays Jon: 333'], transfersOf($summary));
});

test('trip 4 after adding Coffee 3,00 € paid by Kim', function (): void {
    $app = seededApp();
    $ids = array_column(array_map(fn ($m) => [$m->name, $m->id], $app->trips->find(4)->members), 1, 0);
    $all = [$ids['Jon'] => null, $ids['Kim'] => null, $ids['Lea'] => null];

    $input = expenseInput(300, $ids['Kim'], [$ids['Kim'] => 300], 'equal', $all, 'Coffee');
    $app->expenses->create(4, ['date' => '2026-03-05'] + $input);
    $summary = $app->summaries->forTrip(4);

    assertSame(1300, $summary->totalCents);
    assertSame(2, $summary->expenseCount);
    assertSame(['Lea pays Jon: 433', 'Kim pays Jon: 133'], transfersOf($summary));
});

test('trip 5, very large amounts and long names', function (): void {
    $app = seededApp();
    $summary = $app->summaries->forTrip(5);
    $names = array_map(fn ($e) => $e->name, $app->expenses->list(5));

    assertSame(234_567_891, $summary->totalCents);
    assertSame(3, $summary->expenseCount);
    assertSame(['Maximiliane Alexandra von Hohenzollern-Sigmaringen pays Noah: 117283946'], transfersOf($summary));
    assertSame(120, mb_strlen($names[0]), 'The newest expense has a name of the maximum length.');
});

test('trip 6, more than three transfers', function (): void {
    $summary = seededApp()->summaries->forTrip(6);

    assertSame(9000, $summary->totalCents);
    assertSame(
        ['Quinn pays Olga: 2000', 'Rosa pays Olga: 2000', 'Sam pays Olga: 1000', 'Tara pays Paul: 1000'],
        transfersOf($summary),
    );
});

test('trip 7, Madrid weekend: total and transfer', function (): void {
    $app = seededApp();
    $summary = $app->summaries->forTrip(7);

    assertSame(7830, $summary->totalCents);
    assertSame(2, $summary->expenseCount);
    assertSame(['Ana pays Chloé: 915'], transfersOf($summary));
    assertSame(['Ana', 'Chloé'], array_map(fn ($m) => $m->name, $app->trips->find(7)->members));
});

test('trip 7 after adding Churros 6,00 € paid by Ana', function (): void {
    $app = seededApp();
    $ids = array_column(array_map(fn ($m) => [$m->name, $m->id], $app->trips->find(7)->members), 1, 0);
    $both = [$ids['Ana'] => null, $ids['Chloé'] => null];

    $app->expenses->create(7, ['date' => '2026-09-14'] + expenseInput(600, $ids['Ana'], [$ids['Ana'] => 600], 'equal', $both, 'Churros'));
    $summary = $app->summaries->forTrip(7);

    assertSame(8430, $summary->totalCents);
    assertSame(3, $summary->expenseCount);
    assertSame(['Ana pays Chloé: 615'], transfersOf($summary));
});

test('unknown or non-numeric trip ids return 404 not_found', function (): void {
    $app = seededApp();
    $token = tokenFor($app, 'ana@example.com');

    foreach (['/trips/999', '/trips/abc', '/trips/999/summary', '/trips/999/expenses'] as $path) {
        $response = get($app, $path, $token);
        assertSame(404, $response->status, $path);
        assertSame('not_found', $response->data['error']['code'], $path);
    }
});

test('the seeded trips are deterministic', function (): void {
    $snapshot = function (): string {
        $app = seededApp();

        return json_encode(array_map(fn ($t) => $app->summaries->forTrip($t->id), $app->trips->findAll()));
    };

    assertSame($snapshot(), $snapshot());
});
