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

    /** POST body: { display_name, email, password, language? }; the session comes with the email code (verify). */
    public function signUp(Request $request, array $params): JsonResponse
    {
        return new JsonResponse(202, $this->auth->signUp($request->json(), $request->ip));
    }

    /** POST body: { email, code } */
    public function verify(Request $request, array $params): JsonResponse
    {
        [$token, $user] = $this->auth->verify($request->json(), $request->ip);

        return new JsonResponse(200, ['token' => $token, 'user' => $user]);
    }

    /** POST body: { email, language? } */
    public function resendCode(Request $request, array $params): JsonResponse
    {
        return new JsonResponse(202, $this->auth->resendCode($request->json(), $request->ip));
    }

    /** POST body: { email, password, language? } */
    public function logIn(Request $request, array $params): JsonResponse
    {
        [$token, $user] = $this->auth->logIn($request->json(), $request->ip);

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
