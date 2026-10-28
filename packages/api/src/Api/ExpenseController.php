<?php

declare(strict_types=1);

namespace App\Api;

use App\Dto\User;
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

    /**
     * PUT body: as for create. The recorder never changes: any recorded_by sent by the client is ignored.
     * The change is stored with the logged-in user.
     */
    public function update(Request $request, array $params, int $personId, User $user): JsonResponse
    {
        $tripId = (int) $params['tripId'];
        $expense = $this->expenses->update($tripId, (int) $params['expenseId'], $request->json(), $user);

        return new JsonResponse(200, ['expense' => $expense, 'summary' => $this->summaries->forTrip($tripId)]);
    }

    /** GET ?name=…: the category the form should preselect for this name, and where it came from. */
    public function suggestCategory(Request $request, array $params, int $personId): JsonResponse
    {
        $name = $request->query['name'] ?? '';
        [$category, $source] = $this->expenses->suggestCategory((int) $params['tripId'], is_string($name) ? $name : '');

        return new JsonResponse(200, ['category' => $category->value, 'source' => $source]);
    }
}
