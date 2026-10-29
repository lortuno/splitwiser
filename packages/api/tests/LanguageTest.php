<?php

declare(strict_types=1);

use App\Database\Connection;
use App\Database\Schema;

// The account's app language and the params the app needs to word errors itself
// (specs/translations/06-translations-specification.md).

test('an existing database gets users.language, and existing accounts become English', function (): void {
    $pdo = Connection::open(':memory:');
    // The users table as it was before languages existed.
    $pdo->exec("CREATE TABLE users (
        id INTEGER PRIMARY KEY, display_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login_at TEXT)");
    $pdo->exec("INSERT INTO users (display_name, email, password_hash) VALUES ('Old', 'old@example.com', 'x')");

    Schema::apply($pdo);
    Schema::apply($pdo);

    assertSame([['Old', 'en']], array_map(fn ($r) => [$r['display_name'], $r['language']], $pdo->query('SELECT * FROM users')->fetchAll()));
});

test('GET /me, login and sign-up return the language; sign-up stores it, English by default', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');

    assertSame('en', jsonOf(get($app, '/me', $ana))['language']);
    $login = call($app, 'POST', '/auth/login', ['email' => 'ana@example.com', 'password' => App\Database\Seeder::DEMO_PASSWORD]);
    assertSame('en', jsonOf($login)['user']['language']);

    $french = signUpAndVerify($app, 'Lena', 'lena@example.com', 'travel-demo-2026', 'fr');
    assertSame([200, 'fr'], [$french->status, jsonOf($french)['user']['language']]);
    assertSame('fr', jsonOf(get($app, '/me', $french->data['token']))['language']);
    assertSame(202, call($app, 'POST', '/auth/signup', ['display_name' => 'Max', 'email' => 'max@example.com', 'password' => 'travel-demo-2026'])->status);
    $default = call($app, 'POST', '/auth/verify', ['email' => 'max@example.com', 'code' => latestCodeFor('max@example.com')]);
    assertSame('en', jsonOf($default)['user']['language']);

    $invalid = call($app, 'POST', '/auth/signup', ['display_name' => 'Kai', 'email' => 'kai@example.com', 'password' => 'travel-demo-2026', 'language' => 'de']);
    assertSame([422, 'invalid_language'], [$invalid->status, $invalid->data['errors']['language']['code']]);
});

test('PATCH /me records the language alone, with the name, rejects others, and keeps "required" for an empty body', function (): void {
    $app = seededApp();
    $olga = tokenFor($app, 'olga@example.com');

    $spanish = jsonOf(call($app, 'PATCH', '/me', ['language' => 'es'], $olga));
    assertSame(['Olga', 'es'], [$spanish['display_name'], $spanish['language']]);
    assertSame('es', jsonOf(get($app, '/me', $olga))['language'], 'Recorded in the database.');

    $both = jsonOf(call($app, 'PATCH', '/me', ['display_name' => 'Olga M.', 'language' => 'fr'], $olga));
    assertSame(['Olga M.', 'fr'], [$both['display_name'], $both['language']]);

    $name = jsonOf(call($app, 'PATCH', '/me', ['display_name' => 'Olga'], $olga));
    assertSame(['Olga', 'fr'], [$name['display_name'], $name['language']], 'A rename keeps the language.');

    foreach (['de', '', null, 3] as $value) {
        $r = call($app, 'PATCH', '/me', ['language' => $value], $olga);
        assertSame([422, 'invalid_language'], [$r->status, $r->data['errors']['language']['code']], var_export($value, true));
    }
    assertSame('fr', jsonOf(get($app, '/me', $olga))['language'], 'A rejected value changes nothing.');

    $empty = call($app, 'PATCH', '/me', [], $olga);
    assertSame([422, 'required'], [$empty->status, $empty->data['errors']['display_name']['code']]);
    assertSame(401, call($app, 'PATCH', '/me', ['language' => 'es'])->status);
});

test('errors with numbers carry params; other errors carry none', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');
    $m = madrid($app);
    $body = bodyOf($m['prado']);

    $paid = call($app, 'POST', '/trips/7/expenses', ['amount_cents' => 5000, 'paid_by' => [
        ['person_id' => $m['ana'], 'amount_cents' => 2000], ['person_id' => $m['chloe'], 'amount_cents' => 2500],
    ]] + $body, $ana)->data['errors'];
    assertSame(['sum_cents' => 4500, 'amount_cents' => 5000], $paid['paid_by']['params']);

    $exact = call($app, 'POST', '/trips/7/expenses', ['split' => ['type' => 'exact', 'between' => [
        ['person_id' => $m['ana'], 'value' => 1000], ['person_id' => $m['chloe'], 'value' => 1000],
    ]]] + $body, $ana)->data['errors'];
    assertSame(['sum_cents' => 2000, 'amount_cents' => 3000], $exact['split']['params']);

    $percent = call($app, 'POST', '/trips/7/expenses', ['split' => ['type' => 'percentage', 'between' => [
        ['person_id' => $m['ana'], 'value' => 5000], ['person_id' => $m['chloe'], 'value' => 4000],
    ]]] + $body, $ana)->data['errors'];
    assertSame(['sum_basis_points' => 9000, 'total_basis_points' => 10000], $percent['split']['params']);

    $long = call($app, 'POST', '/trips/7/expenses', ['name' => str_repeat('x', 121), 'amount_cents' => 0] + $body, $ana)->data['errors'];
    assertSame(['max' => 120], $long['name']['params']);
    assertTrue(!isset($long['amount_cents']['params']), 'invalid_amount has no params.');

    $trip = call($app, 'POST', '/trips', [
        'name' => str_repeat('t', 81), 'start_date' => '2026-07-10', 'end_date' => '2026-07-17',
        'people' => [['name' => str_repeat('p', 61), 'email' => null]],
    ], $ana)->data['errors'];
    assertSame([['max' => 80], ['max' => 60]], [$trip['name']['params'], $trip['people.0.name']['params']]);
    $many = call($app, 'POST', '/trips', ['name' => 'Big', 'start_date' => '2026-07-10', 'end_date' => '2026-07-17',
        'people' => array_map(fn ($i) => ['name' => "P{$i}", 'email' => null], range(1, 20))], $ana)->data['errors'];
    assertSame(['max' => 20], $many['people']['params']);

    $signup = call($app, 'POST', '/auth/signup', ['display_name' => str_repeat('n', 61), 'email' => 'x@example.com', 'password' => 'short'])->data['errors'];
    assertSame([['max' => 60], ['min' => 8]], [$signup['display_name']['params'], $signup['password']['params']]);
    assertSame(['max' => 60], call($app, 'PATCH', '/me', ['display_name' => str_repeat('n', 61)], $ana)->data['errors']['display_name']['params']);
});
