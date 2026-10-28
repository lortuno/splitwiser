<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\User;
use App\Repository\PersonRepository;
use App\Repository\SessionRepository;
use App\Repository\UserRepository;
use PDO;

/**
 * Sign-up, login and logout with opaque bearer tokens: 32 random bytes as hex, stored only as their SHA-256.
 * Sign-up errors are keyed by form field (display_name, email, password, language), like ExpenseValidator. Errors whose
 * text has a number carry it in params, so the app can word them in its own language.
 * A sign-up links every trip person invited with the same email (trip_invites) to the new account.
 */
final readonly class AuthService
{
    public const int MAX_NAME_LENGTH = 60;
    public const int MIN_PASSWORD_LENGTH = 8;
    public const int MAX_PASSWORD_LENGTH = 200;
    private const int MAX_EMAIL_LENGTH = 254;
    public const array LANGUAGES = ['en', 'es', 'fr'];

    public function __construct(
        private PDO $pdo,
        private UserRepository $users,
        private SessionRepository $sessions,
        private PersonRepository $people,
    ) {
    }

    /** @return array{string, User} the new session token and the new user */
    public function signUp(array $input): array
    {
        $errors = [];
        $name = self::trimmed($input['display_name'] ?? null);
        $email = self::normaliseEmail($input['email'] ?? null);
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';

        if (($nameError = self::displayNameError($name)) !== null) {
            $errors['display_name'] = $nameError;
        }

        if ($email === '') {
            $errors['email'] = ['code' => 'required', 'message' => 'Enter your email.'];
        } elseif (!self::isPlausibleEmail($email)) {
            $errors['email'] = ['code' => 'invalid_email', 'message' => 'Enter an email like ana@example.com.'];
        } elseif ($this->users->idByEmail($email) !== null) {
            $errors['email'] = ['code' => 'taken', 'message' => 'This email already has an account.'];
        }

        if (mb_strlen($password) < self::MIN_PASSWORD_LENGTH) {
            $errors['password'] = ['code' => 'too_short', 'message' => 'Use at least 8 characters.', 'params' => ['min' => self::MIN_PASSWORD_LENGTH]];
        } elseif (mb_strlen($password) > self::MAX_PASSWORD_LENGTH) {
            $errors['password'] = ['code' => 'too_long', 'message' => 'Use at most 200 characters.', 'params' => ['max' => self::MAX_PASSWORD_LENGTH]];
        }

        $language = array_key_exists('language', $input) ? $input['language'] : 'en';
        if (($languageError = self::languageError($language)) !== null) {
            $errors['language'] = $languageError;
        }

        if ($errors !== []) {
            throw new ValidationException($errors);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $this->pdo->beginTransaction();
        try {
            $userId = $this->users->create($name, $email, $hash, $language);
            $this->users->touchLastLogin($userId);
            $this->people->linkInvites($email, $userId);
            $token = $this->startSession($userId);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return [$token, new User($userId, $name, $email, $language)];
    }

    /**
     * PATCH /me: { display_name?, language? }. Each field is validated and saved when present; a body with neither is
     * the "required" error on display_name, as before languages existed.
     */
    public function updateMe(User $user, array $input): User
    {
        $errors = [];
        $hasName = array_key_exists('display_name', $input);
        $hasLanguage = array_key_exists('language', $input);
        $name = self::trimmed($input['display_name'] ?? null);
        if (($hasName || !$hasLanguage) && ($error = self::displayNameError($name)) !== null) {
            $errors['display_name'] = $error;
        }
        if ($hasLanguage && ($error = self::languageError($input['language'])) !== null) {
            $errors['language'] = $error;
        }
        if ($errors !== []) {
            throw new ValidationException($errors);
        }

        if ($hasName) {
            $this->users->updateDisplayName($user->id, $name);
        }
        if ($hasLanguage) {
            $this->users->updateLanguage($user->id, $input['language']);
        }

        return new User($user->id, $hasName ? $name : $user->displayName, $user->email, $hasLanguage ? $input['language'] : $user->language);
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

        $this->users->touchLastLogin($found[0]->id);

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

    /** A plausible x@y.z; $email must already be normalised. */
    public static function isPlausibleEmail(string $email): bool
    {
        return mb_strlen($email) <= self::MAX_EMAIL_LENGTH && preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/u', $email) === 1;
    }

    /** @return array{code: string, message: string}|null */
    private static function displayNameError(string $name): ?array
    {
        return match (true) {
            $name === '' => ['code' => 'required', 'message' => 'Enter your name.'],
            mb_strlen($name) > self::MAX_NAME_LENGTH => ['code' => 'too_long', 'message' => 'Use at most 60 characters.', 'params' => ['max' => self::MAX_NAME_LENGTH]],
            default => null,
        };
    }

    /** @return array{code: string, message: string}|null */
    private static function languageError(mixed $language): ?array
    {
        return in_array($language, self::LANGUAGES, true)
            ? null
            : ['code' => 'invalid_language', 'message' => 'Choose English, Spanish or French.'];
    }

    private static function trimmed(mixed $value): string
    {
        return is_string($value) ? trim($value) : '';
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
