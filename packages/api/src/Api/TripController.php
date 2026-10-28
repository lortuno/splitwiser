<?php

declare(strict_types=1);

namespace App\Api;

use App\Dto\User;
use App\Repository\TripRepository;
use App\Service\NotFoundException;
use App\Service\SummaryService;
use App\Service\TripService;

final readonly class TripController
{
    public function __construct(
        private TripRepository $trips,
        private TripService $service,
        private SummaryService $summaries,
    ) {
    }

    /** POST body: { name, start_date, end_date, people: [{ name, email? }] }; the creator is added by the API. */
    public function create(Request $request, array $params, User $user): JsonResponse
    {
        $trip = $this->service->create($user, $request->json());

        return new JsonResponse(201, ['trip' => $trip, 'summary' => $this->summaries->forTrip($trip->id)]);
    }

    /** Only the trips the logged-in user is a member of. */
    public function list(Request $request, array $params, User $user): JsonResponse
    {
        return new JsonResponse(200, $this->trips->findForUser($user->id));
    }

    public function show(Request $request, array $params, int $personId): JsonResponse
    {
        $tripId = (int) $params['tripId'];
        $trip = $this->trips->find($tripId) ?? throw new NotFoundException("Trip {$tripId} not found.");

        return new JsonResponse(200, $trip);
    }
}
