<?php

declare(strict_types=1);

use App\Api\JsonResponse;
use App\Api\Request;
use App\Api\Routes;
use App\Database\Connection;
use App\Database\Schema;
use App\Database\Seeder;
use App\Settings;

// Feature 8, security: the email code at sign-up, the login lock, the limits, the security log and the headers.
// Emails go to Mailpit; time moves through MovableClock with the real durations.

/** Sends a request from $ip through the router. */
function callFrom(App\Container $app, string $ip, string $method, string $path, array $body = []): JsonResponse
{
    return Routes::build($app)->dispatch(new Request($method, $path, [], json_encode($body, JSON_THROW_ON_ERROR), null, $ip));
}

function logInFrom(App\Container $app, string $ip, string $email, string $password): JsonResponse
{
    return callFrom($app, $ip, 'POST', '/auth/login', ['email' => $email, 'password' => $password]);
}

/** [status, error code] of a response */
function statusAndCode(JsonResponse $response): array
{
    return [$response->status, $response->data['error']['code'] ?? array_values($response->data['errors'] ?? [])[0]['code'] ?? null];
}

function verifyCode(App\Container $app, string $email, string $code): JsonResponse
{
    return call($app, 'POST', '/auth/verify', ['email' => $email, 'code' => $code]);
}

test('sign-up: the same answer for a new, an unverified and a verified email; codes in the chosen language', function (): void {
    $clock = new MovableClock();
    $app = seededApp($clock);
    $before = count(mailsTo('ana@example.com'));

    $new = signUp($app, 'Margot', 'margot@example.com', 'long-enough-1', 'fr');
    $verified = signUp($app, 'Someone', 'ana@example.com', 'another-pass-1', 'es');
    assertSame([202, 202], [$new->status, $verified->status]);
    assertSame(['email' => 'margot@example.com', 'code_minutes' => 15, 'resend_in_seconds' => 60], $new->data);
    assertSame(['email', 'code_minutes', 'resend_in_seconds'], array_keys($verified->data));

    $margot = mailsTo('margot@example.com')[0];
    assertSame('Confirmez votre adresse e-mail', $margot['subject']);
    assertTrue(str_contains($margot['text'], 'Bonjour Margot,') && str_contains($margot['text'], 'Il est valable 15 minutes.'));
    assertSame(1 + $before, count(mailsTo('ana@example.com')));
    assertSame('Ya tienes una cuenta', mailsTo('ana@example.com')[0]['subject']);
    assertTrue(str_contains(mailsTo('ana@example.com')[0]['text'], 'Hola Ana:'));
    assertSame(200, logInFrom($app, '10.0.0.1', 'ana@example.com', Seeder::DEMO_PASSWORD)->status, "Ana's password is unchanged.");

    $clock->forward(60);
    assertSame(202, signUp($app, 'Olaf B', 'margot@example.com', 'second-pass-1', 'en')->status);
    assertSame('Confirm your email', mailsTo('margot@example.com')[0]['subject']);
    $session = verifyCode($app, 'margot@example.com', latestCodeFor('margot@example.com'));
    assertSame('Olaf B', $session->data['user']->displayName, 'An unverified account takes the newest name and password.');
    assertSame(200, logInFrom($app, '10.0.0.1', 'margot@example.com', 'second-pass-1')->status);
    assertSame(401, logInFrom($app, '10.0.0.2', 'margot@example.com', 'long-enough-1')->status);
});

test('sign-up: nothing is saved and 503 when the email cannot be sent', function (): void {
    $pdo = Connection::open(':memory:');
    Schema::apply($pdo);
    $app = new App\Container($pdo, new MovableClock(), new Settings(mailerDsn: 'smtp://127.0.0.1:1'));
    $app->seeder()->seedIfEmpty();

    assertSame([503, 'mail_unavailable'], statusAndCode(signUp($app, 'Rita', 'rita@example.com', 'long-enough-1')));
    assertSame(null, $app->users->idByEmail('rita@example.com'));
    assertSame(0, (int) $pdo->query('SELECT COUNT(*) FROM security_events')->fetchColumn());
});

test('verify: three wrong codes, then a new code; the right one starts a session and links the invites', function (): void {
    $clock = new MovableClock();
    $app = seededApp($clock);
    signUp($app, 'Inés García', 'ines@example.com', 'long-enough-1');
    $first = latestCodeFor('ines@example.com');
    $wrong = $first === '000000' ? '111111' : '000000';

    assertSame([403, 'unverified'], statusAndCode(logInFrom($app, '10.0.0.3', 'ines@example.com', 'long-enough-1')), 'No session before the code.');
    assertSame(1, (int) $app->pdo->query("SELECT COUNT(*) FROM group_invites WHERE email = 'ines@example.com'")->fetchColumn(), 'Nothing linked yet.');
    $tries = [];
    foreach ([1, 2, 3] as $_) {
        $error = verifyCode($app, 'ines@example.com', $wrong)->data['errors']['code'];
        $tries[] = [$error['code'], $error['params']['tries_left'] ?? null];
    }
    assertSame([['wrong', 2], ['wrong', 1], ['too_many', null]], $tries);
    assertSame([422, 'too_many'], statusAndCode(verifyCode($app, 'ines@example.com', latestCodeFor('ines@example.com'))));

    $clock->forward(60);
    assertSame(202, call($app, 'POST', '/auth/resend-code', ['email' => 'ines@example.com', 'language' => 'en'])->status);
    $second = latestCodeFor('ines@example.com');
    if ($second !== $first) {
        assertSame([422, 'wrong'], statusAndCode(verifyCode($app, 'ines@example.com', $first)), 'A new code replaces the old one.');
    }
    $session = verifyCode($app, 'ines@example.com', $second);
    assertSame(200, $session->status);
    assertSame([8], array_map(fn ($t) => $t->id, get($app, '/trips', $session->data['token'])->data));
    assertSame(['Inés García pays Pia: 10000', 'Grandpa pays Pia: 10000'], transfersOf($app->summaries->forTrip(8)));
    assertSame([422, 'expired'], statusAndCode(verifyCode($app, 'ines@example.com', $second)), 'A used code is gone.');
});

test('verify: a code expires after 15 minutes and is stored only as a hash', function (): void {
    $clock = new MovableClock();
    $app = seededApp($clock);
    signUp($app, 'Quentin', 'quentin@example.com', 'long-enough-1');
    $code = latestCodeFor('quentin@example.com');

    assertSame(0, (int) $app->pdo->query("SELECT COUNT(*) FROM email_codes WHERE code_hash = '{$code}'")->fetchColumn());
    $clock->forward(15 * 60);
    assertSame([422, 'expired'], statusAndCode(verifyCode($app, 'quentin@example.com', $code)));
    assertSame([422, 'expired'], statusAndCode(verifyCode($app, 'nobody@example.com', '123456')), 'No pending code reads as expired.');
});

test('resend: the same answer for every email, a code only for unverified ones, at most one a minute and 5 an hour', function (): void {
    $clock = new MovableClock();
    $app = seededApp($clock);
    signUp($app, 'Paula', 'paula@example.com', 'long-enough-1');
    $paulaBefore = count(mailsTo('paula@example.com'));
    $anaBefore = count(mailsTo('ana@example.com'));

    assertSame([429, 'too_soon'], statusAndCode(call($app, 'POST', '/auth/resend-code', ['email' => 'paula@example.com'])));
    $clock->forward(20);
    assertSame(40, call($app, 'POST', '/auth/resend-code', ['email' => 'paula@example.com'])->data['error']['params']['seconds']);
    foreach (['paula@example.com', 'ana@example.com', 'nobody@example.com'] as $email) {
        $clock->forward(60);
        assertSame([202, ['code_minutes' => 15, 'resend_in_seconds' => 60]], [($r = call($app, 'POST', '/auth/resend-code', ['email' => $email]))->status, $r->data], $email);
    }
    assertSame($paulaBefore + 1, count(mailsTo('paula@example.com')));
    assertSame($anaBefore, count(mailsTo('ana@example.com')), 'A verified email gets nothing.');

    for ($i = 0; $i < 3; $i++) {
        $clock->forward(60);
        assertSame(202, call($app, 'POST', '/auth/resend-code', ['email' => 'paula@example.com'])->status);
    }
    $clock->forward(60);
    assertSame([429, 'too_many_requests'], statusAndCode(call($app, 'POST', '/auth/resend-code', ['email' => 'paula@example.com'])), 'The 6th code in an hour.');
    $clock->forward(3600);
    assertSame(202, call($app, 'POST', '/auth/resend-code', ['email' => 'paula@example.com'])->status);
});

test('login lock: 3 failures in 2 minutes lock the email for that IP for 5 minutes', function (): void {
    $clock = new MovableClock();
    $app = seededApp($clock);
    $ip = '10.0.0.8';

    assertSame([401, 'invalid_credentials'], statusAndCode(logInFrom($app, $ip, 'ben@example.com', 'wrong-1')));
    assertSame([401, 'invalid_credentials'], statusAndCode(logInFrom($app, $ip, 'ben@example.com', 'wrong-2')));
    $third = logInFrom($app, $ip, 'ben@example.com', 'wrong-3');
    assertSame([429, 'locked', ['minutes' => 5]], [...statusAndCode($third), $third->data['error']['params']]);
    assertSame('Too many attempts. Try again in 5 minutes.', $third->data['error']['message']);
    assertSame([429, 'locked'], statusAndCode(logInFrom($app, $ip, 'ben@example.com', Seeder::DEMO_PASSWORD)), 'Also the right password.');
    assertSame(200, logInFrom($app, '10.0.0.9', 'ben@example.com', Seeder::DEMO_PASSWORD)->status, 'Another IP is not locked.');

    $clock->forward(4 * 60 + 1);
    assertSame(1, logInFrom($app, $ip, 'ben@example.com', Seeder::DEMO_PASSWORD)->data['error']['params']['minutes'], 'Rounded up.');
    $clock->forward(60);
    assertSame(200, logInFrom($app, $ip, 'ben@example.com', Seeder::DEMO_PASSWORD)->status, 'The lock ends after 5 minutes.');
    assertSame([401, 'invalid_credentials'], statusAndCode(logInFrom($app, $ip, 'ben@example.com', 'wrong-4')), 'Failures before the lock ended do not count.');

    foreach (['a', 'b'] as $attempt) {
        assertSame(401, logInFrom($app, $ip, 'nobody@example.com', "wrong-{$attempt}")->status);
    }
    assertSame([429, 'locked'], statusAndCode(logInFrom($app, $ip, 'nobody@example.com', 'wrong-c')), 'An unknown email locks the same way.');
});

test('login lock: failures spread over more than 2 minutes do not lock', function (): void {
    $clock = new MovableClock();
    $app = seededApp($clock);

    foreach ([1, 2, 3, 4] as $attempt) {
        assertSame(401, logInFrom($app, '10.0.0.10', 'chloe@example.com', "wrong-{$attempt}")->status, "attempt {$attempt}");
        $clock->forward(61);
    }
    assertSame(200, logInFrom($app, '10.0.0.10', 'chloe@example.com', Seeder::DEMO_PASSWORD)->status);
});

test('per IP: at most 10 sign-ups and 20 code checks an hour', function (): void {
    $app = seededApp(new MovableClock());
    $ip = '10.0.0.11';

    for ($i = 1; $i <= 10; $i++) {
        assertSame(202, callFrom($app, $ip, 'POST', '/auth/signup', ['display_name' => "P{$i}", 'email' => "limit-{$i}@example.com", 'password' => 'long-enough-1'])->status, "sign-up {$i}");
    }
    assertSame([429, 'too_many_requests'], statusAndCode(callFrom($app, $ip, 'POST', '/auth/signup', ['display_name' => 'P11', 'email' => 'limit-11@example.com', 'password' => 'long-enough-1'])));
    assertSame(202, callFrom($app, '10.0.0.12', 'POST', '/auth/signup', ['display_name' => 'P11', 'email' => 'limit-11@example.com', 'password' => 'long-enough-1'])->status, 'Another IP may.');

    for ($i = 1; $i <= 20; $i++) {
        assertSame(422, callFrom($app, $ip, 'POST', '/auth/verify', ['email' => 'limit-1@example.com', 'code' => '000000'])->status, "check {$i}");
    }
    assertSame([429, 'too_many_requests'], statusAndCode(callFrom($app, $ip, 'POST', '/auth/verify', ['email' => 'limit-1@example.com', 'code' => '000000'])));
});

test('the security log has the events with email, IP and time, and never a password, a code or a token', function (): void {
    $clock = new MovableClock();
    $app = seededApp($clock);
    signUp($app, 'Nina', 'nina@example.com', 'long-enough-1');
    $code = latestCodeFor('nina@example.com');
    verifyCode($app, 'nina@example.com', '000000' === $code ? '111111' : '000000');
    $token = verifyCode($app, 'nina@example.com', $code)->data['token'];
    logInFrom($app, '10.0.0.13', 'nina@example.com', 'wrong-pass');

    $rows = $app->pdo->query('SELECT event, email, ip, at FROM security_events ORDER BY id')->fetchAll();
    assertSame(
        [['signup', 'nina@example.com'], ['code_sent', 'nina@example.com'], ['code_checked', 'nina@example.com'], ['code_checked', 'nina@example.com'], ['verified', 'nina@example.com'], ['login_failed', 'nina@example.com']],
        array_map(fn ($r) => [$r['event'], $r['email']], $rows),
    );
    assertSame('10.0.0.13', $rows[5]['ip']);
    assertSame($clock->now()->format('Y-m-d H:i:s'), $rows[5]['at']);
    $dump = json_encode($app->pdo->query('SELECT * FROM security_events')->fetchAll());
    foreach (['long-enough-1', 'wrong-pass', $code, $token] as $secret) {
        assertTrue(!str_contains($dump, $secret), 'The log holds no secret.');
    }
});

test('headers: CORS only for the app origin, and the security headers on every response', function (): void {
    $app = new Settings();
    $own = JsonResponse::headers('http://localhost:8081', $app->appOrigin);
    $other = JsonResponse::headers('https://example.org', $app->appOrigin);
    $native = JsonResponse::headers(null, $app->appOrigin);

    assertSame('http://localhost:8081', $own['Access-Control-Allow-Origin']);
    assertTrue(!isset($other['Access-Control-Allow-Origin']) && !isset($native['Access-Control-Allow-Origin']));
    foreach ([$own, $other, $native] as $headers) {
        assertSame(['nosniff', 'no-referrer', 'no-store', 'Origin'], [$headers['X-Content-Type-Options'], $headers['Referrer-Policy'], $headers['Cache-Control'], $headers['Vary']]);
    }
});

test('the IP is the connection address; X-Forwarded-For is ignored', function (): void {
    $_SERVER['REMOTE_ADDR'] = '10.0.0.14';
    $_SERVER['HTTP_X_FORWARDED_FOR'] = '1.2.3.4';
    assertSame('10.0.0.14', Request::fromGlobals()->ip);
    unset($_SERVER['REMOTE_ADDR'], $_SERVER['HTTP_X_FORWARDED_FOR']);
});

test('an existing database: every account is verified once when verified_at is added', function (): void {
    $pdo = Connection::open(':memory:');
    $pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login_at TEXT, language TEXT NOT NULL DEFAULT 'en')");
    $pdo->exec("INSERT INTO users (display_name, email, password_hash) VALUES ('Old', 'old@example.com', 'x')");

    Schema::apply($pdo);
    $verifiedAt = $pdo->query("SELECT verified_at FROM users WHERE email = 'old@example.com'")->fetchColumn();
    assertTrue(is_string($verifiedAt), 'Marked verified.');
    $pdo->exec("INSERT INTO users (display_name, email, password_hash) VALUES ('New', 'new@example.com', 'x')");
    Schema::apply($pdo);
    assertSame([$verifiedAt, null], $pdo->query('SELECT verified_at FROM users ORDER BY id')->fetchAll(PDO::FETCH_COLUMN), 'Only once.');
});

test('every demo account and the admin are verified and log in', function (): void {
    $app = seededApp();
    $app->seeder()->ensureAdmin();

    foreach (Seeder::ACCOUNTS as $email) {
        assertSame(200, logInFrom($app, '10.0.0.15', $email, Seeder::DEMO_PASSWORD)->status, $email);
    }
    assertSame(200, logInFrom($app, '10.0.0.15', Seeder::ADMIN['email'], Seeder::ADMIN['password'])->status);
});
