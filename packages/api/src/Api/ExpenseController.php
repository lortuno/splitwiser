<?php

declare(strict_types=1);

namespace App\Api;

use App\Service\ExpenseService;
use App\Service\SummaryService;

final readonly class ExpenseController
{
    public function __construct(
        private ExpenseService $expenses,
        private SummaryService $summaries,
    ) {
    }

    public function list(Request $request, array $params): JsonResponse
    {
        return new JsonResponse(200, $this->expenses->list((int) $params['tripId']));
    }

    /** POST body: see ExpenseValidator. With ?dry_run=1 only the calculated split is returned. */
    public function create(Request $request, array $params): JsonResponse
    {
        $tripId = (int) $params['tripId'];

        if ($request->flag('dry_run')) {
            return new JsonResponse(200, ['split_between' => $this->expenses->preview($tripId, $request->json())]);
        }

        $expense = $this->expenses->create($tripId, $request->json());

        // The updated summary travels with the new expense so the app needs no second request.
        return new JsonResponse(201, ['expense' => $expense, 'summary' => $this->summaries->forTrip($tripId)]);
    }
}
