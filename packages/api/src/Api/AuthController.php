<?php

declare(strict_types=1);

namespace App\Api;

use App\Dto\User;
use App\Service\AuthService;
use App\Service\DebtService;

final readonly class AuthController
{
    public function __construct(private AuthService $auth, private DebtService $debts)
    {
    }

    /** POST body: { display_name, email, password } */
    public function signUp(Request $request, array $params): JsonResponse
    {
        [$token, $user] = $this->auth->signUp($request->json());

        return new JsonResponse(201, ['token' => $token, 'user' => $user]);
    }

    /** POST body: { email, password } */
    public function logIn(Request $request, array $params): JsonResponse
    {
        [$token, $user] = $this->auth->logIn($request->json());

        return new JsonResponse(200, ['token' => $token, 'user' => $user]);
    }

    public function logOut(Request $request, array $params): JsonResponse
    {
        $this->auth->logOut($request->bearerToken);

        return new JsonResponse(204);
    }

    public function me(Request $request, array $params, User $user): JsonResponse
    {
        return new JsonResponse(200, $user);
    }

    /** PATCH body: { display_name?, language? } */
    public function updateMe(Request $request, array $params, User $user): JsonResponse
    {
        return new JsonResponse(200, $this->auth->updateMe($user, $request->json()));
    }

    /** What the user owes and is owed on their open groups ("I owe" / "I'm owed" on My groups). */
    public function debts(Request $request, array $params, User $user): JsonResponse
    {
        return new JsonResponse(200, $this->debts->forUser($user));
    }
}
