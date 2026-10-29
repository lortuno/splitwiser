<?php

declare(strict_types=1);

use App\Database\Seeder;

// Sign-up, login, sessions, membership and the recorder (specs/accounts/02-login-and-my-groups-specification.md).

const TRIP_ENDPOINTS = ['/trips', '/trips/1', '/trips/1/expenses', '/trips/1/summary', '/me'];

/** @return array<string, string> field => error code of a 422 response */
function errorCodes(App\Api\JsonResponse $response): array
{
    assertSame(422, $response->status);

    return array_map(fn (array $error) => $error['code'], $response->data['errors']);
}

function signUp(App\Container $app, string $name, string $email, string $password): App\Api\JsonResponse
{
    return call($app, 'POST', '/auth/signup', ['display_name' => $name, 'email' => $email, 'password' => $password]);
}

test('sign-up returns a token and the user, and the token works', function (): void {
    $app = seededApp();
    $response = signUp($app, '  Zoe ', ' Zoe@Example.com ', 'long-enough-1');

    assertSame(201, $response->status);
    assertSame(64, strlen($response->data['token']));
    assertSame(['display_name' => 'Zoe', 'email' => 'zoe@example.com', 'language' => 'en'], array_slice($response->data['user']->jsonSerialize(), 1));
    assertSame('Zoe', get($app, '/me', $response->data['token'])->data->displayName);
    assertSame([], get($app, '/trips', $response->data['token'])->data, 'A new account has no trips.');
});

test('sign-up rejects a taken email, also with other case and spaces', function (): void {
    $app = seededApp();

    assertSame(['email' => 'taken'], errorCodes(signUp($app, 'Zoe', 'ana@example.com', 'long-enough-1')));
    assertSame(['email' => 'taken'], errorCodes(signUp($app, 'Zoe', '  ANA@Example.com ', 'long-enough-1')));
});

test('sign-up validates name, email and password', function (): void {
    $app = seededApp();

    assertSame(['display_name' => 'required', 'email' => 'required', 'password' => 'too_short'], errorCodes(call($app, 'POST', '/auth/signup', ['x' => 1])));
    assertSame(['display_name' => 'required'], errorCodes(signUp($app, '   ', 'zoe@example.com', 'long-enough-1')));
    assertSame(['display_name' => 'too_long'], errorCodes(signUp($app, str_repeat('a', 61), 'zoe@example.com', 'long-enough-1')));
    assertSame(['email' => 'invalid_email'], errorCodes(signUp($app, 'Zoe', 'zoe', 'long-enough-1')));
    assertSame(['email' => 'invalid_email'], errorCodes(signUp($app, 'Zoe', 'zoe@example', 'long-enough-1')));
    assertSame(['password' => 'too_short'], errorCodes(signUp($app, 'Zoe', 'zoe@example.com', '1234567')));
    assertSame(['password' => 'too_long'], errorCodes(signUp($app, 'Zoe', 'zoe@example.com', str_repeat('a', 201))));
    assertSame(201, signUp($app, str_repeat('a', 60), 'zoe@example.com', '12345678')->status, '60 characters and 8 characters are fine.');
});

test('sign-up allows a name that is already taken', function (): void {
    $app = seededApp();

    assertSame(201, signUp($app, 'Ana', 'another.ana@example.com', 'long-enough-1')->status);
});

test('login works with the right password, also with a loosely typed email', function (): void {
    $app = seededApp();

    foreach (['ana@example.com', '  ANA@Example.com '] as $email) {
        $response = call($app, 'POST', '/auth/login', ['email' => $email, 'password' => Seeder::DEMO_PASSWORD]);
        assertSame(200, $response->status, $email);
        assertSame('Ana', $response->data['user']->displayName);
    }
});

test('login fails the same way for a wrong password, an unknown email and empty fields', function (): void {
    $app = seededApp();

    foreach ([
        ['email' => 'ana@example.com', 'password' => 'wrong-password'],
        ['email' => 'nobody@example.com', 'password' => Seeder::DEMO_PASSWORD],
        ['email' => '', 'password' => ''],
        [],
    ] as $body) {
        $response = call($app, 'POST', '/auth/login', $body);
        assertSame(401, $response->status);
        assertSame(['code' => 'invalid_credentials', 'message' => 'Email or password is wrong.'], $response->data['error']);
    }
});

test('every endpoint except health, signup and login needs a valid token', function (): void {
    $app = seededApp();

    assertSame(['ok' => true], get($app, '/health')->data);
    foreach ([null, '', 'not-a-token', str_repeat('0', 64)] as $token) {
        foreach (TRIP_ENDPOINTS as $path) {
            $response = get($app, $path, $token);
            assertSame(401, $response->status, "{$path} with token " . var_export($token, true));
            assertSame('unauthenticated', $response->data['error']['code']);
        }
        assertSame(401, call($app, 'POST', '/trips/1/expenses', [], $token)->status);
        assertSame(401, call($app, 'POST', '/auth/logout', [], $token)->status);
    }
});

test('an expired session is rejected', function (): void {
    $app = seededApp();
    $token = tokenFor($app, 'ana@example.com');
    assertSame(200, get($app, '/me', $token)->status);

    $app->pdo->exec("UPDATE sessions SET expires_at = datetime('now', '-1 second')");

    assertSame(401, get($app, '/me', $token)->status);
});

test('a session lasts 24 hours and only the hash of the token is stored', function (): void {
    $app = seededApp();
    $token = tokenFor($app, 'ana@example.com');
    $row = $app->pdo->query("SELECT token_hash, (julianday(expires_at) - julianday('now')) * 24 AS hours FROM sessions")->fetch();

    assertSame(hash('sha256', $token), $row['token_hash']);
    assertTrue(abs($row['hours'] - 24) < 0.1, 'Expires 24 hours after login.');
});

test('logout deletes the session, so the token stops working', function (): void {
    $app = seededApp();
    $token = tokenFor($app, 'ana@example.com');
    $other = tokenFor($app, 'ana@example.com');

    assertSame(204, call($app, 'POST', '/auth/logout', [], $token)->status);
    assertSame(401, get($app, '/me', $token)->status);
    assertSame(200, get($app, '/me', $other)->status, 'Other sessions of the same account stay valid.');
});

test('each demo account lists exactly its own trips, newest first', function (): void {
    $app = seededApp();
    $expected = [
        'ana@example.com' => [[7, 7830], [1, 191557]],
        'ben@example.com' => [[1, 191557]],
        'chloe@example.com' => [[7, 7830], [1, 191557]],
        'david@example.com' => [[1, 191557]],
        'eva@example.com' => [[2, 0]],
        'hugo@example.com' => [[3, 8000]],
        'jon@example.com' => [[4, 1000]],
        'noah@example.com' => [[5, 234_567_891]],
        'olga@example.com' => [[6, 9000]],
        'pia@example.com' => [[8, 30000]],
    ];
    assertSame(array_values(Seeder::ACCOUNTS), array_keys($expected));

    foreach ($expected as $email => $trips) {
        $listed = get($app, '/trips', tokenFor($app, $email))->data;
        assertSame($trips, array_map(fn ($t) => [$t->id, $t->totalCents], $listed), $email);
    }
});

test('a trip the user is not a member of answers 403 not_a_member, after 404 for unknown trips', function (): void {
    $app = seededApp();
    $ben = tokenFor($app, 'ben@example.com');

    foreach (['/trips/7', '/trips/7/expenses', '/trips/7/summary', '/trips/2'] as $path) {
        $response = get($app, $path, $ben);
        assertSame(403, $response->status, $path);
        assertSame(['code' => 'not_a_member', 'message' => 'You are not a member of this group.'], $response->data['error']);
    }
    assertSame(403, call($app, 'POST', '/trips/7/expenses', [], $ben)->status);
    assertSame(404, get($app, '/trips/999', $ben)->status);
    assertSame(200, get($app, '/trips/1', $ben)->status);

    $ana = tokenFor($app, 'ana@example.com');
    foreach ([2, 3, 4, 5, 6] as $tripId) {
        assertSame(403, get($app, "/trips/{$tripId}", $ana)->status, "Ana on trip {$tripId}");
    }
});

test('the recorder is the logged-in person, whatever the client sends', function (): void {
    $app = seededApp();
    $token = tokenFor($app, 'ana@example.com');
    $ids = array_column(array_map(fn ($m) => [$m->name, $m->id], $app->trips->find(1)->members), 1, 0);
    $all = array_fill_keys(array_values($ids), null);

    $withBen = expenseInput(200, $ids['Ben'], [$ids['Ana'] => 200], 'equal', $all, 'Coffee');
    $response = call($app, 'POST', '/trips/1/expenses', $withBen, $token);
    assertSame(201, $response->status);
    assertSame('Ana', $response->data['expense']->recordedBy->name);

    $without = $withBen;
    unset($without['recorded_by']);
    $response = call($app, 'POST', '/trips/1/expenses', $without, $token);
    assertSame(201, $response->status);
    assertSame('Ana', $response->data['expense']->recordedBy->name);

    $response = call($app, 'POST', '/trips/1/expenses', $without, $token, ['dry_run' => '1']);
    assertSame(200, $response->status, 'The split preview needs no recorded_by either.');
});

test('on a trip with Ana twice (trip 1 and 7), each trip records its own Ana', function (): void {
    $app = seededApp();
    $token = tokenFor($app, 'ana@example.com');
    $ids = array_column(array_map(fn ($m) => [$m->name, $m->id], $app->trips->find(7)->members), 1, 0);
    $body = expenseInput(600, 0, [$ids['Ana'] => 600], 'equal', [$ids['Ana'] => null, $ids['Chloé'] => null], 'Churros');

    $expense = call($app, 'POST', '/trips/7/expenses', $body, $token)->data['expense'];

    assertSame($ids['Ana'], $expense->recordedBy->id);
});
