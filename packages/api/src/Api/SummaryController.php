<?php

declare(strict_types=1);

namespace App\Api;

use App\Service\SummaryService;

final readonly class SummaryController
{
    public function __construct(private SummaryService $summaries)
    {
    }

    public function show(Request $request, array $params, int $personId): JsonResponse
    {
        return new JsonResponse(200, $this->summaries->forTrip((int) $params['tripId']));
    }
}
