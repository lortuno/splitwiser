<?php

declare(strict_types=1);

use App\Database\Connection;
use App\Database\Schema;
use App\Service\CategoryGuesser;

// Expense categories (specs/05-expense-categories-specification.md). The fixture list pins every guess: add an entry
// whenever a wrong guess is reported, then fix CategoryKeywords until the list passes again.

/** [expense name, expected category] — "other" means no word matched. */
const CATEGORY_FIXTURES = [
    // English
    ['Dinner at the harbour', 'food'], ['Lunch', 'food'], ['Breakfast buffet', 'food'], ['Pizza night', 'food'],
    ['Sushi', 'food'], ['Burger and fries', 'food'], ['Seafood dinner in Matosinhos', 'food'], ['Group dinner', 'food'],
    ['Groceries at Pingo Doce', 'groceries'], ['Supermarket run', 'groceries'], ['Lidl', 'groceries'],
    ['Beers at the pub', 'drinks'], ['Cocktails', 'drinks'], ['Fado night drinks', 'drinks'], ['Port wine tasting', 'drinks'],
    ['Coffee and cake', 'coffee'], ['Starbucks', 'coffee'], ['Ice cream', 'coffee'], ['Bakery', 'coffee'],
    ['Gasoline', 'fuel'], ['Petrol', 'fuel'], ['Gas station', 'fuel'], ['Fuel for the rental', 'fuel'], ['Diesel', 'fuel'],
    ['Taxi to Porto airport', 'transport'], ['Airport taxi to Alfama', 'transport'], ['Train to Sintra', 'transport'],
    ['Tram 28 tickets', 'transport'], ['Metro day passes', 'transport'], ['Uber home', 'transport'],
    ['Car rental', 'transport'], ['Parking', 'transport'], ['Ferry to the island', 'transport'], ['Bus', 'transport'],
    ['Flight to Madrid', 'flights'], ['Private jet charter', 'flights'], ['Ryanair tickets', 'flights'], ['Boarding pass', 'flights'],
    ['Hotel', 'lodging'], ['Airbnb Porto, 3 nights', 'lodging'], ['Hostel', 'lodging'], ['Booking.com apartment', 'lodging'],
    ['Museum tickets', 'activities'], ['Pena Palace tickets', 'activities'], ['Livraria Lello entrance', 'activities'],
    ['Douro valley boat tour', 'activities'], ['Boat tickets', 'activities'], ['Yacht week', 'activities'],
    ['Ski passes', 'activities'], ['Concert', 'activities'], ['Zoo', 'activities'], ['Prado Museum tickets', 'activities'],
    ['Azulejo tile souvenir', 'shopping'], ['Sunscreen and pharmacy', 'shopping'], ['Gifts', 'shopping'], ['New shoes', 'shopping'],
    // German
    ['Abendessen im Hotel', 'food'], ['Hotel Abendessen', 'lodging'], ['Mittagessen', 'food'], ['Frühstück', 'food'],
    ['Einkauf bei Rewe', 'groceries'], ['Supermarkt', 'groceries'], ['Bier und Wein', 'drinks'], ['Getränke', 'drinks'],
    ['Kaffee und Kuchen', 'coffee'], ['Bäckerei', 'coffee'], ['Tanken', 'fuel'], ['Benzin bei Aral', 'fuel'],
    ['Tankstelle', 'fuel'], ['Zug nach Berlin', 'transport'], ['Straßenbahn', 'transport'], ['Mietwagen', 'transport'],
    ['Flug nach Palma', 'flights'], ['Ferienwohnung', 'lodging'], ['Unterkunft', 'lodging'], ['Eintritt Schloss', 'activities'],
    ['Führung durch die Altstadt', 'activities'], ['Kino', 'activities'], ['Apotheke', 'shopping'], ['Geschenke', 'shopping'],
    // Spanish
    ['Cena en el puerto', 'food'], ['Comida', 'food'], ['Desayuno', 'food'], ['Tapas at Mercado de San Miguel', 'food'],
    ['Supermercado', 'groceries'], ['Mercadona', 'groceries'], ['Cervezas', 'drinks'], ['Vino tinto', 'drinks'],
    ['Café con churros', 'coffee'], ['Helado', 'coffee'], ['Gasolina', 'fuel'], ['Gasolinera Repsol', 'fuel'],
    ['Tren a Sevilla', 'transport'], ['Alquiler de coche', 'transport'], ['Peaje', 'transport'], ['Vuelo a Lisboa', 'flights'],
    ['Alojamiento', 'lodging'], ['Hostal', 'lodging'], ['Entradas museo', 'activities'], ['Excursión', 'activities'],
    ['Farmacia', 'shopping'], ['Regalos', 'shopping'], ['Ropa', 'shopping'],
    // Typos
    ['Gasolne Repsol', 'fuel'], ['gasolin', 'fuel'], ['Restaruant', 'food'], ['Abendesen', 'food'], ['Dinnner', 'food'],
    ['Breakfst', 'food'], ['Groceires', 'groceries'], ['Cocktials', 'drinks'], ['Supermarkt Lidl', 'groceries'],
    ['Hotle', 'other'], ['Museeum', 'activities'], ['Souvnir', 'shopping'], ['Apartmnt', 'lodging'],
    // Ambiguous and short words (explicit decisions)
    ['Gas', 'fuel'], ['Bar', 'drinks'], ['Car', 'transport'], ['Bars', 'other'], ['Cars', 'other'],
    ['Port', 'other'], ['Airport', 'other'], ['Boat', 'other'],
    // No match
    ['Xyzzy', 'other'], ['Miscellaneous', 'other'], ['Stuff for Ana', 'other'], ['', 'other'], ['!!!', 'other'],
    ['Overnight sleeper train from Lisbon to Madrid with a private compartment, breakfast, late checkout, and luggage storage.', 'transport'],
];

/** The category an expense name gets, as a code ("other" when nothing matched). */
function guessed(string $name): string
{
    return (new CategoryGuesser())->guess($name)?->value ?? 'other';
}

/** @return array<string, string> expense name => category on a trip, sorted by name */
function categoriesOn(App\Container $app, int $tripId): array
{
    $categories = array_column(array_map(fn ($e) => [$e->name, $e->category->value], $app->expenses->list($tripId)), 1, 0);
    ksort($categories);

    return $categories;
}

/** @param array<string, string> $categories */
function sortedByName(array $categories): array
{
    ksort($categories);

    return $categories;
}

test('the guesser matches every fixture name', function (): void {
    $wrong = [];
    foreach (CATEGORY_FIXTURES as [$name, $expected]) {
        $actual = guessed($name);
        if ($actual !== $expected) {
            $wrong[] = "\"{$name}\": expected {$expected}, got {$actual}";
        }
    }

    assertSame([], $wrong);
    assertTrue(count(CATEGORY_FIXTURES) >= 120, 'About 120 fixture names.');
});

test('the name key lowercases, strips accents and punctuation', function (): void {
    assertSame('gasolina repsol', CategoryGuesser::nameKey("Gasolina  Repsol!"));
    assertSame('pasteis de belem', CategoryGuesser::nameKey('Pastéis de Belém'));
    assertSame('strassenbahn fruhstuck', CategoryGuesser::nameKey('Straßenbahn – Frühstück'));
    assertSame('cafe con churros', CategoryGuesser::nameKey('CAFÉ con churros'));
    assertSame('', CategoryGuesser::nameKey(' … '));
});

test('every seed expense gets the category of the spec table', function (): void {
    $app = seededApp();

    assertSame(sortedByName([
        'Airport taxi to Alfama' => 'transport', 'Pastéis de Belém breakfast' => 'food', 'Dinner at the harbour' => 'food',
        'Tram 28 tickets' => 'transport', 'Museum tickets' => 'activities', 'Groceries at Pingo Doce' => 'groceries',
        'Train to Sintra' => 'transport', 'Pena Palace tickets' => 'activities', 'Azulejo tile souvenir' => 'shopping',
        'Train to Porto' => 'transport', 'Airbnb Porto, 3 nights' => 'lodging', 'Fado night drinks' => 'drinks',
        'Port wine tasting' => 'drinks', 'Livraria Lello entrance' => 'activities', 'Francesinha lunch' => 'food',
        'Douro valley boat tour' => 'activities', 'Sunscreen and pharmacy' => 'shopping',
        'Seafood dinner in Matosinhos' => 'food', 'Metro day passes' => 'transport', 'Taxi to Porto airport' => 'transport',
    ]), categoriesOn($app, 1));
    assertSame(['Dinner' => 'food', 'Lunch' => 'food'], categoriesOn($app, 3));
    assertSame(['Taxi' => 'transport'], categoriesOn($app, 4));
    $sleeper = App\Database\Seeder::fixtures()[3][4][2][1];
    assertSame(sortedByName(['Private jet charter' => 'flights', 'Yacht week' => 'activities', $sleeper => 'transport']), categoriesOn($app, 5));
    assertSame(['Boat tickets' => 'activities', 'Group dinner' => 'food'], categoriesOn($app, 6));
    assertSame(['Prado Museum tickets' => 'activities', 'Tapas at Mercado de San Miguel' => 'food'], categoriesOn($app, 7));
    assertSame(['Ski passes' => 'activities'], categoriesOn($app, 8));
});

test('the trip learns: the newest expense with the same name key decides, only on that trip', function (): void {
    $app = seededApp();
    $m = madrid($app);
    $ana = tokenFor($app, 'ana@example.com');
    $body = ['name' => 'Dinner and wine', 'category' => 'drinks', 'date' => '2026-09-14'] + bodyOf($m['prado']);
    call($app, 'POST', '/trips/7/expenses', $body, $ana);

    assertSame(['category' => 'drinks', 'source' => 'trip'], call($app, 'GET', '/trips/7/category-suggestion', token: $ana, query: ['name' => 'dinner and WINE'])->data);
    assertSame(['category' => 'food', 'source' => 'keywords'], call($app, 'GET', '/trips/1/category-suggestion', token: $ana, query: ['name' => 'Dinner and wine'])->data);

    call($app, 'POST', '/trips/7/expenses', ['category' => 'food'] + $body, $ana);
    assertSame('food', call($app, 'GET', '/trips/7/category-suggestion', token: $ana, query: ['name' => 'Dinner and wine'])->data['category'], 'The newest one wins.');

    $guessed = call($app, 'POST', '/trips/7/expenses', array_diff_key($body, ['category' => 0]), $ana)->data['expense'];
    assertSame('food', $guessed->category->value, 'A POST without category takes the suggestion, trip learning included.');
});

test('the suggestion endpoint: keywords, none, blank names, errors, and a paid trip', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');
    $suggest = fn (int $trip, ?string $name, ?string $token = null) =>
        call($app, 'GET', "/trips/{$trip}/category-suggestion", token: $token ?? $ana, query: $name === null ? [] : ['name' => $name]);

    assertSame(['category' => 'fuel', 'source' => 'keywords'], $suggest(1, 'gasolne')->data);
    assertSame(['category' => 'other', 'source' => 'none'], $suggest(1, 'Xyzzy')->data);
    assertSame(['category' => 'other', 'source' => 'none'], $suggest(1, null)->data);
    assertSame(['category' => 'other', 'source' => 'none'], $suggest(1, '   ')->data);

    assertSame(401, call($app, 'GET', '/trips/1/category-suggestion', query: ['name' => 'x'])->status);
    assertSame([404, 'not_found'], [($r = $suggest(999, 'x'))->status, errorCode($r)]);
    assertSame([403, 'not_a_member'], [($r = $suggest(7, 'x', tokenFor($app, 'ben@example.com')))->status, errorCode($r)]);

    call($app, 'POST', '/trips/7/paid', token: $ana);
    assertSame(['category' => 'food', 'source' => 'trip'], $suggest(7, 'tapas at mercado de san miguel')->data, 'Read-only, so it answers on a paid trip.');
});

test('writes: invalid category with the other errors, PUT keeps or changes it, category-only edits are edits', function (): void {
    $app = seededApp();
    $hugo = tokenFor($app, 'hugo@example.com');
    $lunch = array_values(array_filter($app->expenses->list(3), fn ($e) => $e->name === 'Lunch'))[0];
    $body = ['name' => 'Taxi'] + bodyOf($lunch);

    $invalid = call($app, 'POST', '/trips/3/expenses', ['category' => 'pets', 'amount_cents' => 0] + $body, $hugo);
    assertSame(422, $invalid->status);
    assertSame(['amount_cents', 'category'], array_keys(array_intersect_key($invalid->data['errors'], ['amount_cents' => 1, 'category' => 1])));
    assertSame(['invalid_category', 'Choose one of the categories.'], array_values($invalid->data['errors']['category']));
    assertSame('invalid_category', call($app, 'POST', '/trips/3/expenses', ['category' => 3] + $body, $hugo)->data['errors']['category']['code']);

    $created = call($app, 'POST', '/trips/3/expenses', $body, $hugo);
    assertSame([201, 'transport'], [$created->status, jsonOf($created)['expense']['category']]);
    $id = $created->data['expense']->id;

    $changed = jsonOf(call($app, 'PUT', "/trips/3/expenses/{$id}", ['category' => 'other'] + $body, $hugo))['expense'];
    assertSame(['other', true], [$changed['category'], $changed['edited']]);
    $change = changesOf($app, $id);
    assertSame(1, count($change));
    assertSame(['transport', 'other'], [json_decode($change[0]['before_json'], true)['category'], json_decode($change[0]['after_json'], true)['category']]);

    $kept = jsonOf(call($app, 'PUT', "/trips/3/expenses/{$id}", $body, $hugo))['expense'];
    assertSame('other', $kept['category'], 'A PUT without category keeps the stored one.');
    assertSame(1, count(changesOf($app, $id)), 'Nothing else changed, so nothing is written.');
    $listed = array_map(fn ($e) => $e['category'], jsonOf(get($app, '/trips/3/expenses', $hugo)));
    sort($listed);
    assertSame(['food', 'food', 'other'], $listed, 'The list carries category.');
});

test('an existing database gets the column, keeps its rows, and the backfill guesses once', function (): void {
    $pdo = Connection::open(':memory:');
    $pdo->exec('PRAGMA foreign_keys = OFF');
    // The expenses table as it was before categories existed.
    $pdo->exec('CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL)');
    $pdo->exec("CREATE TABLE expenses (
        id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, name TEXT NOT NULL, spent_on TEXT NOT NULL,
        amount_cents INTEGER NOT NULL, recorded_by INTEGER NOT NULL, split_type TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    $pdo->exec("INSERT INTO trips VALUES (1, 'Old trip', '2026-01-01', '2026-01-02')");
    $pdo->exec("INSERT INTO expenses (trip_id, name, spent_on, amount_cents, recorded_by, split_type) VALUES
        (1, 'Gasolina Repsol', '2026-01-01', 5000, 1, 'equal'), (1, 'Xyzzy', '2026-01-01', 100, 1, 'equal')");

    Schema::apply($pdo);
    Schema::apply($pdo);
    $app = new App\Container($pdo);
    assertSame([null, null], $pdo->query('SELECT category FROM expenses ORDER BY id')->fetchAll(PDO::FETCH_COLUMN));

    assertSame(2, $app->expenses->backfillCategories());
    assertSame(0, $app->expenses->backfillCategories());
    assertSame(
        [['Gasolina Repsol', 5000, 'fuel'], ['Xyzzy', 100, 'other']],
        array_map(fn ($r) => [$r['name'], $r['amount_cents'], $r['category']], $pdo->query('SELECT * FROM expenses ORDER BY id')->fetchAll()),
    );
});

test('a fresh seed needs no backfill and keeps its figures', function (): void {
    $app = seededApp();

    assertSame(0, $app->expenses->backfillCategories());
    assertSame(191557, $app->summaries->forTrip(1)->totalCents);
    assertSame(['Ana pays Chloé: 915'], transfersOf($app->summaries->forTrip(7)));
});
