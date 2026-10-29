<?php

declare(strict_types=1);

// Editing expenses, marking a trip as paid and reopening it (specs/expenses/04-edit-expenses-and-mark-as-paid-specification.md).
// Figures are those of trip 7 "Madrid weekend" in the spec's seed section.

/** The response as the app receives it: DTOs turned into plain arrays. */
function jsonOf(App\Api\JsonResponse $response): mixed
{
    return json_decode(json_encode($response->data, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
}

/** @return array{tapas: App\Dto\Expense, prado: App\Dto\Expense, ana: int, chloe: int} trip 7 as seeded */
function madrid(App\Container $app): array
{
    $expenses = array_column(array_map(fn ($e) => [$e->name, $e], $app->expenses->list(7)), 1, 0);
    $people = array_column(array_map(fn ($m) => [$m->name, $m->id], $app->trips->find(7)->members), 1, 0);

    return [
        'tapas' => $expenses['Tapas at Mercado de San Miguel'],
        'prado' => $expenses['Prado Museum tickets'],
        'ana' => $people['Ana'],
        'chloe' => $people['Chloé'],
    ];
}

/** The PUT body that re-sends an expense exactly as stored. */
function bodyOf(App\Dto\Expense $expense): array
{
    return [
        'name' => $expense->name,
        'date' => $expense->date,
        'amount_cents' => $expense->amountCents,
        'paid_by' => array_map(fn ($p) => ['person_id' => $p->personId, 'amount_cents' => $p->amountCents], $expense->paidBy),
        'split' => [
            'type' => $expense->splitType->value,
            'between' => array_map(fn ($s) => ['person_id' => $s->personId, 'value' => $s->splitValue], $expense->splitBetween),
        ],
    ];
}

/** @return list<array<string, mixed>> the change records of an expense, oldest first */
function changesOf(App\Container $app, int $expenseId): array
{
    $stmt = $app->pdo->prepare('SELECT * FROM expense_changes WHERE expense_id = ? ORDER BY id');
    $stmt->execute([$expenseId]);

    return $stmt->fetchAll();
}

function errorCode(App\Api\JsonResponse $response): ?string
{
    return $response->data['error']['code'] ?? null;
}

test('editing an amount recalculates shares, balances and transfers and keeps the recorder', function (): void {
    $app = seededApp();
    $m = madrid($app);
    $ana = tokenFor($app, 'ana@example.com');
    $createdAt = $app->pdo->query("SELECT created_at FROM expenses WHERE id = {$m['tapas']->id}")->fetchColumn();

    $body = ['amount_cents' => 5001, 'paid_by' => [['person_id' => $m['chloe'], 'amount_cents' => 5001]]] + bodyOf($m['tapas']);
    $response = call($app, 'PUT', "/trips/7/expenses/{$m['tapas']->id}", ['recorded_by' => $m['ana']] + $body, $ana);

    assertSame(200, $response->status);
    $expense = $response->data['expense'];
    assertSame([5001, 'Chloé', true], [$expense->amountCents, $expense->recordedBy->name, $expense->edited]);
    assertSame([$m['ana'] => 2501, $m['chloe'] => 2500], sharesOf($expense), 'Ana has the lower person id and gets the leftover cent.');
    $summary = $response->data['summary'];
    assertSame(8001, $summary->totalCents);
    assertSame([$m['ana'] => -1001, $m['chloe'] => 1001], netsOf($summary));
    assertSame(['Ana pays Chloé: 1001'], transfersOf($summary));
    assertSame($createdAt, $app->pdo->query("SELECT created_at FROM expenses WHERE id = {$m['tapas']->id}")->fetchColumn());
});

test('an edit stores one change record with the editor, a time and full before/after snapshots', function (): void {
    $app = seededApp();
    $m = madrid($app);
    $ana = tokenFor($app, 'ana@example.com');

    $body = ['split' => ['type' => 'percentage', 'between' => [
        ['person_id' => $m['chloe'], 'value' => 3000],
        ['person_id' => $m['ana'], 'value' => 7000],
    ]]] + bodyOf($m['prado']);
    $response = call($app, 'PUT', "/trips/7/expenses/{$m['prado']->id}", $body, $ana);

    assertSame([$m['ana'] => 2100, $m['chloe'] => 900], sharesOf($response->data['expense']));
    $changes = changesOf($app, $m['prado']->id);
    assertSame(1, count($changes));
    assertSame($app->users->idByEmail('ana@example.com'), (int) $changes[0]['changed_by']);
    assertTrue(preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $changes[0]['changed_at']) === 1);
    $paidBy = [['person_id' => $m['ana'], 'amount_cents' => 3000]];
    assertSame([
        'name' => 'Prado Museum tickets', 'date' => $m['prado']->date, 'amount_cents' => 3000, 'category' => 'activities', 'paid_by' => $paidBy,
        'split' => ['type' => 'equal', 'between' => [['person_id' => $m['ana'], 'value' => null], ['person_id' => $m['chloe'], 'value' => null]]],
    ], json_decode($changes[0]['before_json'], true));
    assertSame([
        'name' => 'Prado Museum tickets', 'date' => $m['prado']->date, 'amount_cents' => 3000, 'category' => 'activities', 'paid_by' => $paidBy,
        'split' => ['type' => 'percentage', 'between' => [['person_id' => $m['ana'], 'value' => 7000], ['person_id' => $m['chloe'], 'value' => 3000]]],
    ], json_decode($changes[0]['after_json'], true), 'Lists are sorted by person id.');
});

test('checks 4 and 5 together: Madrid ends at 80,01 € with Ana paying Chloé 16,01 €', function (): void {
    $app = seededApp();
    $m = madrid($app);
    $ana = tokenFor($app, 'ana@example.com');

    call($app, 'PUT', "/trips/7/expenses/{$m['tapas']->id}", ['amount_cents' => 5001, 'paid_by' => [['person_id' => $m['chloe'], 'amount_cents' => 5001]]] + bodyOf($m['tapas']), $ana);
    $response = call($app, 'PUT', "/trips/7/expenses/{$m['prado']->id}", ['split' => ['type' => 'percentage', 'between' => [
        ['person_id' => $m['ana'], 'value' => 7000], ['person_id' => $m['chloe'], 'value' => 3000],
    ]]] + bodyOf($m['prado']), $ana);

    $summary = $response->data['summary'];
    assertSame(8001, $summary->totalCents);
    assertSame(['Ana pays Chloé: 1601'], transfersOf($summary));
    assertSame([[3000, 4601], [5001, 3400]], array_map(fn ($b) => [$b->paidCents, $b->shareCents], $summary->balances));
    assertSame([true, true], array_map(fn ($e) => $e['edited'], jsonOf(get($app, '/trips/7/expenses', $ana))));
    assertSame('Ana', madrid($app)['prado']->recordedBy->name, 'Prado still reads "Recorded by Ana".');
});

test('a save without changes writes nothing and keeps edited false', function (): void {
    $app = seededApp();
    $m = madrid($app);

    $response = call($app, 'PUT', "/trips/7/expenses/{$m['tapas']->id}", bodyOf($m['tapas']), tokenFor($app, 'ana@example.com'));

    assertSame(200, $response->status);
    assertSame(false, jsonOf($response)['expense']['edited']);
    assertSame([], changesOf($app, $m['tapas']->id));
    assertSame(['Ana pays Chloé: 915'], transfersOf($response->data['summary']));
});

test('the very large amount saves unchanged without becoming edited', function (): void {
    $app = seededApp();
    $jet = array_values(array_filter($app->expenses->list(5), fn ($e) => $e->name === 'Private jet charter'))[0];

    $response = call($app, 'PUT', "/trips/5/expenses/{$jet->id}", bodyOf($jet), tokenFor($app, 'noah@example.com'));

    assertSame([200, 100_000_000, false], [$response->status, $response->data['expense']->amountCents, $response->data['expense']->edited]);
    assertSame(234_567_891, $response->data['summary']->totalCents);
});

test('an edit answers the same 422 field errors as a new expense', function (): void {
    $app = seededApp();
    $m = madrid($app);
    $ana = tokenFor($app, 'ana@example.com');
    $body = ['name' => ' ', 'amount_cents' => 0] + bodyOf($m['prado']);

    $edit = call($app, 'PUT', "/trips/7/expenses/{$m['prado']->id}", $body, $ana);
    $create = call($app, 'POST', '/trips/7/expenses', $body, $ana);

    assertSame(422, $edit->status);
    assertSame($create->data, $edit->data);
    assertSame('Enter a name for the expense.', $edit->data['errors']['name']['message']);
    assertSame('Enter an amount greater than 0.', $edit->data['errors']['amount_cents']['message']);
    assertSame([], changesOf($app, $m['prado']->id));
});

test('edited is part of list, create and edit responses', function (): void {
    $app = seededApp();
    $m = madrid($app);
    $ana = tokenFor($app, 'ana@example.com');

    assertSame([false, false], array_map(fn ($e) => $e['edited'], jsonOf(get($app, '/trips/7/expenses', $ana))));
    $body = bodyOf($m['prado']);
    assertSame(false, jsonOf(call($app, 'POST', '/trips/7/expenses', $body, $ana))['expense']['edited']);
    assertSame(true, jsonOf(call($app, 'PUT', "/trips/7/expenses/{$m['prado']->id}", ['name' => 'Prado'] + $body, $ana))['expense']['edited']);
});

test('edit access: 401, unknown trip, non-member, expense of another trip, unknown expense', function (): void {
    $app = seededApp();
    $m = madrid($app);
    $ana = tokenFor($app, 'ana@example.com');
    $body = bodyOf($m['tapas']);

    assertSame([401, 'unauthenticated'], [($r = call($app, 'PUT', "/trips/7/expenses/{$m['tapas']->id}", $body))->status, errorCode($r)]);
    assertSame([404, 'not_found'], [($r = call($app, 'PUT', "/trips/999/expenses/{$m['tapas']->id}", $body, $ana))->status, errorCode($r)]);
    $ben = tokenFor($app, 'ben@example.com');
    assertSame([403, 'not_a_member'], [($r = call($app, 'PUT', "/trips/7/expenses/{$m['tapas']->id}", $body, $ben))->status, errorCode($r)]);
    assertSame([404, 'not_found'], [($r = call($app, 'PUT', "/trips/1/expenses/{$m['tapas']->id}", $body, $ana))->status, errorCode($r)]);
    assertSame([404, 'not_found'], [($r = call($app, 'PUT', '/trips/7/expenses/99999', $body, $ana))->status, errorCode($r)]);
    assertSame([], changesOf($app, $m['tapas']->id));
});

test('marking as paid stores who and when, and the summary keeps the real numbers', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');

    $response = call($app, 'POST', '/trips/7/paid', token: $ana);

    assertSame(200, $response->status);
    $summary = jsonOf($response)['summary'];
    assertSame(['id' => madrid($app)['ana'], 'name' => 'Ana'], $summary['paid']['by']);
    assertTrue(preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', $summary['paid']['at']) === 1, $summary['paid']['at']);
    assertSame(7830, $summary['total_cents']);
    assertSame(915, $summary['transfers'][0]['amount_cents']);
    assertSame($summary['paid'], jsonOf(get($app, '/trips/7/summary', tokenFor($app, 'chloe@example.com')))['paid']);
    $row = $app->pdo->query('SELECT group_id, status, changed_by FROM group_status_changes')->fetchAll();
    assertSame([[7, 'paid', $app->users->idByEmail('ana@example.com')]], array_map(fn ($r) => [(int) $r['group_id'], $r['status'], (int) $r['changed_by']], $row));
});

test('paid.by shows the marker\'s current name on the trip', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');
    call($app, 'POST', '/trips/7/paid', token: $ana);

    call($app, 'PATCH', '/me', ['display_name' => 'Ana María'], $ana);

    assertSame('Ana María', jsonOf(get($app, '/trips/7/summary', $ana))['paid']['by']['name']);
});

test('GET /trips reports paid, an open trip has paid null in its summary', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');
    assertSame(null, jsonOf(get($app, '/trips/1/summary', $ana))['paid']);

    call($app, 'POST', '/trips/7/paid', token: $ana);

    assertSame([7 => true, 1 => false], array_column(jsonOf(get($app, '/trips', $ana)), 'paid', 'id'));
});

test('a paid trip answers 409 trip_paid to new, previewed and edited expenses, before 422', function (): void {
    $app = seededApp();
    $m = madrid($app);
    $chloe = tokenFor($app, 'chloe@example.com');
    call($app, 'POST', '/trips/7/paid', token: tokenFor($app, 'ana@example.com'));
    $valid = bodyOf($m['tapas']);

    foreach ([
        call($app, 'POST', '/trips/7/expenses', $valid, $chloe),
        call($app, 'POST', '/trips/7/expenses', $valid, $chloe, ['dry_run' => '1']),
        call($app, 'PUT', "/trips/7/expenses/{$m['tapas']->id}", ['amount_cents' => 5001] + $valid, $chloe),
        call($app, 'PUT', "/trips/7/expenses/{$m['tapas']->id}", ['name' => ''] + $valid, $chloe),
        call($app, 'POST', '/trips/7/expenses', [], $chloe),
    ] as $i => $response) {
        assertSame([409, 'trip_paid'], [$response->status, errorCode($response)], "request {$i}");
    }
    assertSame('This group is marked as paid. Reopen it to make changes.', call($app, 'POST', '/trips/7/expenses', $valid, $chloe)->data['error']['message']);
    assertSame(2, $app->summaries->forTrip(7)->expenseCount);
    assertSame([], changesOf($app, $m['tapas']->id));
});

test('marking twice gives already_paid, reopening an open trip gives already_open', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');

    assertSame([409, 'already_open'], [($r = call($app, 'POST', '/trips/7/reopen', token: $ana))->status, errorCode($r)]);
    call($app, 'POST', '/trips/7/paid', token: $ana);
    assertSame([409, 'already_paid'], [($r = call($app, 'POST', '/trips/7/paid', token: tokenFor($app, 'chloe@example.com')))->status, errorCode($r)]);
    assertSame('This group is already marked as paid.', $r->data['error']['message']);
    assertSame(1, (int) $app->pdo->query('SELECT COUNT(*) FROM group_status_changes')->fetchColumn());
});

test('any member can reopen; afterwards writes work again and the numbers are unchanged', function (): void {
    $app = seededApp();
    $m = madrid($app);
    $chloe = tokenFor($app, 'chloe@example.com');
    call($app, 'POST', '/trips/7/paid', token: tokenFor($app, 'ana@example.com'));

    $response = call($app, 'POST', '/trips/7/reopen', token: $chloe);

    assertSame(200, $response->status);
    assertSame(null, jsonOf($response)['summary']['paid']);
    assertSame(['Ana pays Chloé: 915'], transfersOf($response->data['summary']));
    $last = $app->pdo->query('SELECT status, changed_by FROM group_status_changes ORDER BY id DESC LIMIT 1')->fetch();
    assertSame(['open', $app->users->idByEmail('chloe@example.com')], [$last['status'], (int) $last['changed_by']]);
    assertSame(200, call($app, 'PUT', "/trips/7/expenses/{$m['tapas']->id}", ['name' => 'Tapas'] + bodyOf($m['tapas']), $chloe)->status);
    assertSame(201, call($app, 'POST', '/trips/7/expenses', bodyOf($m['prado']), $chloe)->status);
    assertSame(false, array_column(jsonOf(get($app, '/trips', $chloe)), 'paid', 'id')[7]);
});

test('paid and reopen: 401 without a token, 404 for an unknown trip, 403 for a non-member', function (): void {
    $app = seededApp();
    $ben = tokenFor($app, 'ben@example.com');

    foreach (['paid', 'reopen'] as $action) {
        assertSame([401, 'unauthenticated'], [($r = call($app, 'POST', "/trips/7/{$action}"))->status, errorCode($r)], $action);
        assertSame([404, 'not_found'], [($r = call($app, 'POST', "/trips/999/{$action}", token: $ben))->status, errorCode($r)], $action);
        assertSame([403, 'not_a_member'], [($r = call($app, 'POST', "/trips/7/{$action}", token: $ben))->status, errorCode($r)], $action);
    }
    assertSame(0, (int) $app->pdo->query('SELECT COUNT(*) FROM group_status_changes')->fetchColumn());
});
