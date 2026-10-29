<?php

declare(strict_types=1);

use App\Database\Seeder;

// The local admin login (specs/accounts/07-admin-account-specification.md): an ordinary account, created when its email is
// free, never changed afterwards.

/** A fresh database seeded and started like `bin/init-db.php` does. */
function startedApp(): App\Container
{
    $app = seededApp();
    $app->seeder()->ensureAdmin();

    return $app;
}

/** Logs in the admin (its password is not the demo password) and returns the token. */
function adminToken(App\Container $app): string
{
    return $app->auth->logIn(['email' => Seeder::ADMIN['email'], 'password' => Seeder::ADMIN['password']], '127.0.0.1')[0];
}

function adminRow(App\Container $app): array|false
{
    $stmt = $app->pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([Seeder::ADMIN['email']]);

    return $stmt->fetch();
}

test('ensureAdmin creates the admin once, after the demo accounts', function (): void {
    $app = seededApp();

    assertSame(true, $app->seeder()->ensureAdmin());
    assertSame(false, $app->seeder()->ensureAdmin());

    $row = adminRow($app);
    assertSame([11, 'Admin', 'admin@travel.local', 'en'], [(int) $row['id'], $row['display_name'], $row['email'], $row['language']]);
    assertTrue(str_starts_with($row['password_hash'], '$2y$'), 'bcrypt, like the demo accounts');
    assertTrue(password_verify('admin123', $row['password_hash']));
    assertSame(11, (int) $app->pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
    assertSame(range(1, 10), array_map('intval', $app->pdo->query('SELECT id FROM users WHERE id <> 11 ORDER BY id')->fetchAll(PDO::FETCH_COLUMN)));
});

test('the admin is linked to no person and is on no trip', function (): void {
    $app = startedApp();
    $id = (int) adminRow($app)['id'];
    $token = adminToken($app);

    assertSame(0, (int) $app->pdo->query("SELECT COUNT(*) FROM people WHERE user_id = {$id}")->fetchColumn());
    assertSame([], jsonOf(get($app, '/trips', $token)));
    assertSame(403, get($app, '/trips/1', $token)->status, 'No extra rights.');
});

test('the admin logs in with admin123 and any case of the email; a wrong password fails', function (): void {
    $app = startedApp();

    $login = fn (string $email, string $password) => call($app, 'POST', '/auth/login', ['email' => $email, 'password' => $password]);
    $ok = $login('  ADMIN@Travel.local ', 'admin123');
    assertSame([200, 'Admin', 'en'], [$ok->status, jsonOf($ok)['user']['display_name'], jsonOf($ok)['user']['language']]);
    assertSame([401, 'invalid_credentials'], [($r = $login('admin@travel.local', 'admin1234'))->status, $r->data['error']['code']]);
});

test('an existing account with the admin email is left unchanged', function (): void {
    $app = seededApp();
    call($app, 'POST', '/auth/signup', ['display_name' => 'Somebody', 'email' => 'admin@travel.local', 'password' => 'another-password', 'language' => 'fr']);

    assertSame(false, $app->seeder()->ensureAdmin());

    $row = adminRow($app);
    assertSame(['Somebody', 'fr'], [$row['display_name'], $row['language']]);
    assertTrue(!password_verify('admin123', $row['password_hash']), 'admin123 does not work for it.');
});

test('a rename and a language change survive the next start', function (): void {
    $app = startedApp();
    $token = adminToken($app);
    call($app, 'PATCH', '/me', ['display_name' => 'Laura', 'language' => 'es'], $token);

    assertSame(false, $app->seeder()->ensureAdmin());

    $me = jsonOf(get($app, '/me', $token));
    assertSame(['Laura', 'es'], [$me['display_name'], $me['language']]);
    assertSame(200, call($app, 'POST', '/auth/login', ['email' => 'admin@travel.local', 'password' => 'admin123'])->status);
});

test('signing up with the admin email only sends "You already have an account"; the seeded figures are unchanged', function (): void {
    $app = startedApp();
    $before = count(mailsTo('admin@travel.local'));

    $signup = call($app, 'POST', '/auth/signup', ['display_name' => 'Someone', 'email' => 'admin@travel.local', 'password' => 'travel-demo-2026']);
    assertSame(202, $signup->status);
    assertSame($before + 1, count(mailsTo('admin@travel.local')));
    assertSame('You already have an account', mailsTo('admin@travel.local')[0]['subject']);
    adminToken($app); // admin123 still logs in
    assertSame(191557, $app->summaries->forTrip(1)->totalCents);
    assertSame(['Ana pays Chloé: 915'], transfersOf($app->summaries->forTrip(7)));
    assertSame([7, 1], array_map(fn ($t) => $t->id, get($app, '/trips', tokenFor($app, 'ana@example.com'))->data));
    assertSame(9, call($app, 'POST', '/trips', ['name' => 'Team lunch', 'start_date' => '2026-11-03', 'end_date' => '2026-11-03',
        'people' => [['name' => 'Ana', 'email' => 'ana@example.com']]], adminToken($app))->data['trip']->id);
});
