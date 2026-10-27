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

    public function list(Request $request, array $params, int $personId): JsonResponse
    {
        return new JsonResponse(200, $this->expenses->list((int) $params['tripId']));
    }

    /**
     * POST body: see ExpenseValidator. With ?dry_run=1 only the calculated split is returned.
     * The recorder is always the logged-in person: any recorded_by sent by the client is replaced.
     */
    public function create(Request $request, array $params, int $personId): JsonResponse
    {
        $tripId = (int) $params['tripId'];
        $input = [...$request->json(), 'recorded_by' => $personId];

        if ($request->flag('dry_run')) {
            return new JsonResponse(200, ['split_between' => $this->expenses->preview($tripId, $input)]);
        }

        $expense = $this->expenses->create($tripId, $input);

        // The updated summary travels with the new expense so the app needs no second request.
        return new JsonResponse(201, ['expense' => $expense, 'summary' => $this->summaries->forTrip($tripId)]);
    }
}
