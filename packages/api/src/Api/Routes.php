<?php

declare(strict_types=1);

namespace App\Api;

use App\Container;
use App\Dto\User;

final class Routes
{
    public static function build(Container $c): Router
    {
        $auth = new AuthController($c->auth, $c->debts);
        $trips = new TripController($c->trips, $c->tripService, $c->tripStatus, $c->summaries);
        $expenses = new ExpenseController($c->expenses, $c->summaries);
        $summary = new SummaryController($c->summaries);

        // Handlers behind $loggedIn get the session's user; behind $member the user's person id on {tripId}, then the user.
        // Order of errors: 401 without a valid session, then 404 for an unknown trip, then 403 for a non-member.
        $loggedIn = static fn (callable $handler): \Closure =>
            static fn (Request $r, array $p): JsonResponse => $handler($r, $p, $c->auth->userFor($r->bearerToken));
        $member = static fn (callable $handler): \Closure => $loggedIn(
            static fn (Request $r, array $p, User $u): JsonResponse => $handler($r, $p, $c->access->personFor((int) $p['tripId'], $u), $u),
        );

        $router = new Router();
        $router->add('GET', '/health', static fn (): JsonResponse => new JsonResponse(200, ['ok' => true]));
        $router->add('POST', '/auth/signup', $auth->signUp(...));
        $router->add('POST', '/auth/login', $auth->logIn(...));
        $router->add('POST', '/auth/logout', $auth->logOut(...));
        $router->add('GET', '/me', $loggedIn($auth->me(...)));
        $router->add('PATCH', '/me', $loggedIn($auth->updateMe(...)));
        $router->add('GET', '/me/debts', $loggedIn($auth->debts(...)));
        $router->add('GET', '/trips', $loggedIn($trips->list(...)));
        $router->add('POST', '/trips', $loggedIn($trips->create(...)));
        $router->add('GET', '/trips/{tripId}', $member($trips->show(...)));
        $router->add('GET', '/trips/{tripId}/expenses', $member($expenses->list(...)));
        $router->add('POST', '/trips/{tripId}/expenses', $member($expenses->create(...)));
        $router->add('GET', '/trips/{tripId}/category-suggestion', $member($expenses->suggestCategory(...)));
        $router->add('PUT', '/trips/{tripId}/expenses/{expenseId}', $member($expenses->update(...)));
        $router->add('POST', '/trips/{tripId}/paid', $member($trips->markPaid(...)));
        $router->add('POST', '/trips/{tripId}/reopen', $member($trips->reopen(...)));
        $router->add('GET', '/trips/{tripId}/summary', $member($summary->show(...)));

        return $router;
    }
}
