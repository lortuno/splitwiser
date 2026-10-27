<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\User;
use App\Repository\SessionRepository;
use App\Repository\UserRepository;

/**
 * Sign-up, login and logout with opaque bearer tokens: 32 random bytes as hex, stored only as their SHA-256.
 * Sign-up errors are keyed by form field (name, email, password), like ExpenseValidator.
 */
final readonly class AuthService
{
    public const int MAX_NAME_LENGTH = 60;
    public const int MIN_PASSWORD_LENGTH = 8;
    public const int MAX_PASSWORD_LENGTH = 200;
    private const int MAX_EMAIL_LENGTH = 254;

    public function __construct(
        private UserRepository $users,
        private SessionRepository $sessions,
    ) {
    }

    /** @return array{string, User} the new session token and the new user */
    public function signUp(array $input): array
    {
        $errors = [];
        $name = is_string($input['name'] ?? null) ? trim($input['name']) : '';
        $email = self::normaliseEmail($input['email'] ?? null);
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';

        if ($name === '') {
            $errors['name'] = ['code' => 'required', 'message' => 'Enter your name.'];
        } elseif (mb_strlen($name) > self::MAX_NAME_LENGTH) {
            $errors['name'] = ['code' => 'too_long', 'message' => 'Use at most 60 characters.'];
        }

        if ($email === '') {
            $errors['email'] = ['code' => 'required', 'message' => 'Enter your email.'];
        } elseif (mb_strlen($email) > self::MAX_EMAIL_LENGTH || preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/u', $email) !== 1) {
            $errors['email'] = ['code' => 'invalid_email', 'message' => 'Enter an email like ana@example.com.'];
        } elseif ($this->users->idByEmail($email) !== null) {
            $errors['email'] = ['code' => 'taken', 'message' => 'This email already has an account.'];
        }

        if (mb_strlen($password) < self::MIN_PASSWORD_LENGTH) {
            $errors['password'] = ['code' => 'too_short', 'message' => 'Use at least 8 characters.'];
        } elseif (mb_strlen($password) > self::MAX_PASSWORD_LENGTH) {
            $errors['password'] = ['code' => 'too_long', 'message' => 'Use at most 200 characters.'];
        }

        if ($errors !== []) {
            throw new ValidationException($errors);
        }

        $userId = $this->users->create($name, $email, password_hash($password, PASSWORD_DEFAULT));

        return [$this->startSession($userId), new User($userId, $name, $email)];
    }

    /** @return array{string, User} a new session token and the user */
    public function logIn(array $input): array
    {
        $email = self::normaliseEmail($input['email'] ?? null);
        $password = $input['password'] ?? null;
        $found = $email === '' ? null : $this->users->findWithHashByEmail($email);

        if ($found === null || !is_string($password) || !password_verify($password, $found[1])) {
            throw UnauthorizedException::invalidCredentials();
        }

        return [$this->startSession($found[0]->id), $found[0]];
    }

    public function logOut(?string $token): void
    {
        $this->userFor($token);
        $this->sessions->delete(self::hash((string) $token));
    }

    /** The user of a valid, unexpired session, or 401 unauthenticated. */
    public function userFor(?string $token): User
    {
        $userId = $token === null || $token === '' ? null : $this->sessions->findUserId(self::hash($token));
        $user = $userId === null ? null : $this->users->find($userId);

        return $user ?? throw UnauthorizedException::unauthenticated();
    }

    public static function normaliseEmail(mixed $value): string
    {
        return is_string($value) ? mb_strtolower(trim($value)) : '';
    }

    private function startSession(int $userId): string
    {
        $token = bin2hex(random_bytes(32));
        $this->sessions->create(self::hash($token), $userId);

        return $token;
    }

    private static function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
