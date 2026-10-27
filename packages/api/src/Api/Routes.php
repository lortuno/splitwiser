<?php

declare(strict_types=1);

namespace App\Api;

use App\Container;

final class Routes
{
    public static function build(Container $c): Router
    {
        $trips = new TripController($c->trips);
        $expenses = new ExpenseController($c->expenses, $c->summaries);
        $summary = new SummaryController($c->summaries);

        $router = new Router();
        $router->add('GET', '/trips', $trips->list(...));
        $router->add('GET', '/trips/{tripId}', $trips->show(...));
        $router->add('GET', '/trips/{tripId}/expenses', $expenses->list(...));
        $router->add('POST', '/trips/{tripId}/expenses', $expenses->create(...));
        $router->add('GET', '/trips/{tripId}/summary', $summary->show(...));

        return $router;
    }
}
