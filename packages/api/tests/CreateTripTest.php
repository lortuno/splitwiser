<?php

declare(strict_types=1);

// Creating trips, linking members by email, display names (specs/03-create-a-trip-specification.md).

/** A valid POST /trips body; $people as [name, email|null] pairs. */
function tripInput(array $people = [['Ben', 'ben@example.com'], ['Grandma', null]], string $name = 'Summer in Sicily'): array
{
    return [
        'name' => $name,
        'start_date' => '2026-07-10',
        'end_date' => '2026-07-17',
        'people' => array_map(fn (array $p) => ['name' => $p[0], 'email' => $p[1]], $people),
    ];
}

/** @return list<int> ids of the trips listed for $token */
function listedTripIds(App\Container $app, string $token): array
{
    return array_map(fn ($t) => $t->id, get($app, '/trips', $token)->data);
}

/** @return array<string, string> field => error code of POST /trips */
function createErrors(App\Container $app, array $body, string $token): array
{
    $codes = errorCodes(call($app, 'POST', '/trips', $body, $token));
    ksort($codes);

    return $codes;
}

function invitesOnTrip(App\Container $app, int $tripId): int
{
    $stmt = $app->pdo->prepare('SELECT COUNT(*) FROM trip_invites i JOIN trip_members m ON m.person_id = i.person_id WHERE m.trip_id = ?');
    $stmt->execute([$tripId]);

    return (int) $stmt->fetchColumn();
}

function tripCount(App\Container $app): int
{
    return (int) $app->pdo->query('SELECT COUNT(*) FROM trips')->fetchColumn();
}

test('creating a trip adds the creator first, linked, and returns the trip with an empty summary', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');

    $response = call($app, 'POST', '/trips', tripInput(), $ana);

    assertSame(201, $response->status);
    $trip = $response->data['trip'];
    assertSame(9, $trip->id, 'The first trip created after the seed.');
    assertSame(['Summer in Sicily', '2026-07-10', '2026-07-17', 0], [$trip->name, $trip->startDate, $trip->endDate, $trip->totalCents]);
    assertSame(['Ana', 'Ben', 'Grandma'], array_map(fn ($m) => $m->name, $trip->members));
    $summary = $response->data['summary'];
    assertSame([0, 0, []], [$summary->totalCents, $summary->expenseCount, $summary->transfers]);
    assertSame([0, 0, 0], array_values(netsOf($summary)));
    assertSame([7, 9, 1], listedTripIds($app, $ana), 'Newest start date first: Madrid, Sicily, Lisbon.');
    assertSame(200, get($app, '/trips/9', $ana)->status);
});

test('an email of an existing account links the person at once, also typed loosely', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');

    call($app, 'POST', '/trips', tripInput([['Ben', '  BEN@Example.com '], ['Grandma', '']]), $ana);

    assertSame([9, 1], listedTripIds($app, tokenFor($app, 'ben@example.com')));
    assertSame(0, invitesOnTrip($app, 9), 'No invite for a linked email.');
    assertSame([7, 1], listedTripIds($app, tokenFor($app, 'chloe@example.com')), 'Chloé was not added.');
    assertSame(403, get($app, '/trips/9', tokenFor($app, 'chloe@example.com'))->status);
});

test('an email without an account waits in trip_invites and is linked at sign-up', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');
    call($app, 'POST', '/trips', tripInput([['Lena', 'lena@example.com']]), $ana);

    assertSame(1, invitesOnTrip($app, 9));

    $signUp = signUp($app, 'Lena Berg', ' Lena@Example.com ', 'long-enough-1');
    $lena = $signUp->data['token'];

    assertSame([9], listedTripIds($app, $lena));
    assertSame(['Ana', 'Lena Berg'], array_map(fn ($m) => $m->name, get($app, '/trips/9', $lena)->data->members));
    assertSame(0, invitesOnTrip($app, 9));
});

test('seeded invite: signing up as ines@example.com links Inés on Ski week', function (): void {
    $app = seededApp();
    assertSame(1, (int) $app->pdo->query("SELECT COUNT(*) FROM trip_invites WHERE email = 'ines@example.com'")->fetchColumn());

    $ines = signUp($app, 'Inés García', 'ines@example.com', 'long-enough-1')->data['token'];

    assertSame([8], listedTripIds($app, $ines));
    $summary = get($app, '/trips/8/summary', $ines)->data;
    assertSame(['Inés García pays Pia: 10000', 'Grandpa pays Pia: 10000'], transfersOf($summary));
});

test('trip 8, Ski week: total, transfers and members', function (): void {
    $app = seededApp();
    $summary = $app->summaries->forTrip(8);

    assertSame(30000, $summary->totalCents);
    assertSame(1, $summary->expenseCount);
    assertSame(['Inés pays Pia: 10000', 'Grandpa pays Pia: 10000'], transfersOf($summary));
    assertSame([20000, -10000, -10000], array_values(netsOf($summary)));
    assertSame([[8, 30000]], array_map(fn ($t) => [$t->id, $t->totalCents], get($app, '/trips', tokenFor($app, 'pia@example.com'))->data));
});

test('expenses can be paid by and split with a name-only member', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');
    $members = call($app, 'POST', '/trips', tripInput(), $ana)->data['trip']->members;
    [$a, $b, $g] = array_map(fn ($m) => $m->id, $members);

    $dinner = expenseInput(1000, 0, [$a => 1000], 'equal', [$a => null, $b => null, $g => null], 'Dinner');
    assertSame(201, call($app, 'POST', '/trips/9/expenses', ['date' => '2026-07-10'] + $dinner, $ana)->status);
    $summary = $app->summaries->forTrip(9);

    assertSame(1000, $summary->totalCents);
    assertSame([$a => 666, $b => -333, $g => -333], netsOf($summary));
    assertSame(['Ben pays Ana: 333', 'Grandma pays Ana: 333'], transfersOf($summary));
    assertSame([334, 333, 333], array_values(sharesOf($app->expenses->list(9)[0])));

    $taxi = expenseInput(500, 0, [$g => 500], 'equal', [$g => null, $b => null], 'Taxi');
    assertSame(201, call($app, 'POST', '/trips/9/expenses', $taxi, $ana)->status, 'Grandma can pay too.');
});

test('trip validation: name and dates', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');
    $body = tripInput();

    assertSame(['name' => 'required'], createErrors($app, ['name' => '   '] + $body, $ana));
    assertSame(['name' => 'too_long'], createErrors($app, ['name' => str_repeat('a', 81)] + $body, $ana));
    assertSame(['end_date' => 'before_start'], createErrors($app, ['start_date' => '2026-07-17', 'end_date' => '2026-07-10'] + $body, $ana));
    assertSame(['end_date' => 'invalid_date', 'start_date' => 'invalid_date'], createErrors($app, ['start_date' => '2026-02-30', 'end_date' => '10.07.2026'] + $body, $ana));
    assertSame(['start_date' => 'invalid_date'], createErrors($app, ['start_date' => null] + $body, $ana), 'No before_start without a valid start.');
    assertSame(201, call($app, 'POST', '/trips', ['name' => str_repeat('a', 80), 'end_date' => '2026-07-10'] + $body, $ana)->status, '80 characters, one day.');
});

test('trip validation: people', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');

    assertSame(['people' => 'too_few'], createErrors($app, tripInput([]), $ana));
    assertSame(['people' => 'too_few'], createErrors($app, ['people' => 'Ben'] + tripInput(), $ana));
    $nineteen = array_map(fn (int $i) => ["P{$i}", null], range(1, 19));
    assertSame(['people' => 'too_many'], createErrors($app, tripInput([...$nineteen, ['P20', null]]), $ana));
    assertSame(['people.0.name' => 'required'], createErrors($app, tripInput([[' ', null]]), $ana));
    assertSame(['people.0.name' => 'too_long'], createErrors($app, tripInput([[str_repeat('b', 61), null]]), $ana));
    assertSame(
        ['people.0.email' => 'duplicate_email', 'people.0.name' => 'duplicate', 'people.1.email' => 'invalid_email', 'people.2.name' => 'duplicate'],
        createErrors($app, tripInput([['ana', 'ana@example.com'], ['Ben', 'ben@x'], ['ben', null]]), $ana),
        'The creator counts; only the later duplicate is marked; all errors at once.',
    );
    assertSame(['people.1.email' => 'duplicate_email'], createErrors($app, tripInput([['Ben', 'ben@example.com'], ['Bea', ' BEN@example.com']]), $ana));
    assertSame(8, tripCount($app), 'Nothing was saved.');

    assertSame(201, call($app, 'POST', '/trips', tripInput([['Chloé', null], ['Chloe', null]]), $ana)->status, 'Accents count.');
    assertSame(201, call($app, 'POST', '/trips', tripInput($nineteen), $ana)->status, '20 people including the creator.');
    assertSame(201, call($app, 'POST', '/trips', tripInput([[str_repeat('b', 60), '   ']]), $ana)->status, 'Only spaces is no email.');
});

test('PATCH /me renames the account everywhere, and validates the name', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');
    call($app, 'POST', '/trips', tripInput(), $ana);

    $response = call($app, 'PATCH', '/me', ['display_name' => '  Ana María '], $ana);

    assertSame(200, $response->status);
    assertSame(['display_name' => 'Ana María', 'email' => 'ana@example.com', 'language' => 'en'], array_slice($response->data->jsonSerialize(), 1));
    assertSame('Ana María', get($app, '/me', $ana)->data->displayName);
    $lisbon = $app->summaries->forTrip(1);
    assertSame('Ana María pays Ben: 6375', transfersOf($lisbon)[0]);
    assertSame('Ana María', $lisbon->balances[0]->name);
    $taxi = array_values(array_filter($app->expenses->list(1), fn ($e) => $e->name === 'Airport taxi to Alfama'))[0];
    assertSame(['Ana María', 'Ana María'], [$taxi->recordedBy->name, $taxi->paidBy[0]->name]);
    assertSame('Ana María', $app->trips->find(9)->members[0]->name, 'Also on a trip she created.');

    assertSame(['display_name' => 'required'], errorCodes(call($app, 'PATCH', '/me', ['display_name' => '  '], $ana)));
    assertSame(['display_name' => 'too_long'], errorCodes(call($app, 'PATCH', '/me', ['display_name' => str_repeat('a', 61)], $ana)));
    assertSame(200, call($app, 'PATCH', '/me', ['display_name' => 'Ben'], $ana)->status, 'Names may repeat.');
});

test('login and sign-up set last_login_at; seeded accounts start without one', function (): void {
    $app = seededApp();
    $lastLogin = fn (string $email) => $app->pdo->query("SELECT last_login_at FROM users WHERE email = '{$email}'")->fetchColumn();

    assertSame(null, $lastLogin('ana@example.com'));
    tokenFor($app, 'ana@example.com');
    assertTrue(is_string($lastLogin('ana@example.com')));
    signUp($app, 'Zoe', 'zoe@example.com', 'long-enough-1');
    assertTrue(is_string($lastLogin('zoe@example.com')));
});

test('POST /trips and PATCH /me need a token', function (): void {
    $app = seededApp();

    foreach ([['POST', '/trips', tripInput()], ['PATCH', '/me', ['display_name' => 'X']]] as [$method, $path, $body]) {
        $response = call($app, $method, $path, $body);
        assertSame(401, $response->status, "{$method} {$path}");
        assertSame('unauthenticated', $response->data['error']['code']);
    }
    assertSame(8, tripCount($app));
});
