<?php

declare(strict_types=1);

namespace App\Api;

use App\Repository\TripRepository;
use App\Service\NotFoundException;

final readonly class TripController
{
    public function __construct(private TripRepository $trips)
    {
    }

    public function list(Request $request, array $params): JsonResponse
    {
        return new JsonResponse(200, $this->trips->findAll());
    }

    public function show(Request $request, array $params): JsonResponse
    {
        $tripId = (int) $params['tripId'];
        $trip = $this->trips->find($tripId) ?? throw new NotFoundException("Trip {$tripId} not found.");

        return new JsonResponse(200, $trip);
    }
}
