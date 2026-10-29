<?php

declare(strict_types=1);

namespace App\Service;

use App\Clock;
use App\Dto\User;
use App\Mail\AuthEmails;
use App\Mail\MailSender;
use App\Repository\EmailCodeRepository;
use App\Repository\PersonRepository;
use App\Repository\SecurityEventRepository;
use App\Repository\SessionRepository;
use App\Repository\UserRepository;
use App\Settings;
use PDO;

/**
 * Sign-up with an email code, login with a lock after failed attempts, and logout with opaque bearer tokens: 32 random
 * bytes as hex, stored only as their SHA-256.
 * Sign-up errors are keyed by form field (display_name, email, password, language), like ExpenseValidator. Errors whose
 * text has a number carry it in params, so the app can word them in its own language.
 * Sign-up never tells whether an email has an account (feature 8, security): it always answers the same, emails a code
 * to a new or unverified account and "You already have an account" to a verified one. The session, and the linking of
 * every group person invited with that email (group_invites), wait for the code. Every limit and the login lock count
 * security_events; per email they count also for emails without an account, so no answer shows whether one exists.
 */
final readonly class AuthService
{
    public const int MAX_NAME_LENGTH = 60;
    public const int MIN_PASSWORD_LENGTH = 8;
    public const int MAX_PASSWORD_LENGTH = 200;
    private const int MAX_EMAIL_LENGTH = 254;
    public const array LANGUAGES = ['en', 'es', 'fr'];
    public const int CODE_TRIES = 3;
    public const int FAILURES_TO_LOCK = 3;
    public const int CODES_PER_HOUR = 5;
    public const int SIGNUPS_PER_IP_PER_HOUR = 10;
    public const int CODE_CHECKS_PER_IP_PER_HOUR = 20;
    private const array CODE_EVENTS = ['code_sent', 'already_registered_sent'];
    private const string TIME_FORMAT = 'Y-m-d H:i:s';

    public function __construct(
        private PDO $pdo,
        private UserRepository $users,
        private SessionRepository $sessions,
        private PersonRepository $people,
        private EmailCodeRepository $codes,
        private SecurityEventRepository $events,
        private MailSender $mail,
        private Clock $clock,
        private Settings $settings,
    ) {
    }

    /**
     * POST /auth/signup: the same answer for a new, an unverified and a verified email. Nothing is saved when the email
     * cannot be sent (503).
     * @return array{email: string, code_minutes: int, resend_in_seconds: int}
     */
    public function signUp(array $input, string $ip): array
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
        if ($this->events->count(['signup'], $this->ago(3600), ip: $ip) >= self::SIGNUPS_PER_IP_PER_HOUR) {
            throw ApiException::tooManyRequests();
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $this->transaction(function () use ($name, $email, $hash, $language, $ip): void {
            $this->events->add('signup', $email, $ip, $this->now());
            $found = $this->users->findWithHashByEmail($email);
            $mayEmail = $this->secondsUntilNextCode($email) === 0 && !$this->codesPerHourReached($email);
            if ($found !== null && $found[2]) {
                if ($mayEmail) {
                    $this->events->add('already_registered_sent', $email, $ip, $this->now());
                    $this->mail->send($email, ...AuthEmails::alreadyRegistered($language, $found[0]->displayName));
                }

                return;
            }
            if ($found === null) {
                $userId = $this->users->create($name, $email, $hash, $language);
            } else {
                $userId = $found[0]->id;
                $this->users->replaceUnverified($userId, $name, $hash, $language);
            }
            if ($mayEmail) {
                $this->sendCode($userId, $email, $name, $language, $ip);
            }
        });

        return ['email' => $email, ...$this->codeTimes($email)];
    }

    /**
     * POST /auth/verify: the right code verifies the account, links its invites and starts a session.
     * @return array{string, User} the new session token and the user
     */
    public function verify(array $input, string $ip): array
    {
        if ($this->events->count(['code_checked'], $this->ago(3600), ip: $ip) >= self::CODE_CHECKS_PER_IP_PER_HOUR) {
            throw ApiException::tooManyRequests();
        }
        $email = self::normaliseEmail($input['email'] ?? null);
        $code = is_string($input['code'] ?? null) ? trim($input['code']) : '';
        $this->events->add('code_checked', $email, $ip, $this->now());

        $found = $email === '' ? null : $this->users->findWithHashByEmail($email);
        $pending = $found === null || $found[2] ? null : $this->codes->find($found[0]->id);
        if ($pending === null || $pending['expires_at'] <= $this->now()) {
            throw self::codeError('expired', 'This code has expired. Send a new code.');
        }
        if ($pending['tries_left'] <= 0) {
            throw self::codeError('too_many', 'Too many wrong codes. Send a new code.');
        }
        $user = $found[0];
        if (!hash_equals($pending['code_hash'], self::hash($code))) {
            $left = $this->codes->useTry($user->id);
            throw $left === 0
                ? self::codeError('too_many', 'Too many wrong codes. Send a new code.')
                : self::codeError('wrong', "This code is wrong. {$left} tries left.", ['tries_left' => $left]);
        }

        $token = $this->transaction(function () use ($user, $email, $ip): string {
            $this->users->markVerified($user->id);
            $this->codes->delete($user->id);
            $this->people->linkInvites($email, $user->id);
            $this->users->touchLastLogin($user->id);
            $this->events->add('verified', $email, $ip, $this->now());

            return $this->startSession($user->id);
        });

        return [$token, $user];
    }

    /**
     * POST /auth/resend-code: a new code for an unverified account; nothing for an unknown or verified email, with the
     * same answer and the same limits.
     * @return array{code_minutes: int, resend_in_seconds: int}
     */
    public function resendCode(array $input, string $ip): array
    {
        $email = self::normaliseEmail($input['email'] ?? null);
        $language = in_array($input['language'] ?? null, self::LANGUAGES, true) ? $input['language'] : 'en';
        if (($wait = $this->secondsUntilNextCode($email)) > 0) {
            throw ApiException::tooSoon($wait);
        }
        if ($this->codesPerHourReached($email)) {
            throw ApiException::tooManyRequests();
        }

        $this->transaction(function () use ($email, $language, $ip): void {
            $found = $email === '' ? null : $this->users->findWithHashByEmail($email);
            if ($found !== null && !$found[2]) {
                $this->sendCode($found[0]->id, $email, $found[0]->displayName, $language, $ip);
            } else {
                $this->events->add('code_sent', $email, $ip, $this->now());
            }
        });

        return $this->codeTimes($email);
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

    /**
     * POST /auth/login. Checked in this order: the lock for this email and IP, the password, then verification. The 3rd
     * failure within the failure window locks the email for that IP; an unknown email is counted and locked the same way.
     * @return array{string, User} a new session token and the user
     */
    public function logIn(array $input, string $ip): array
    {
        $email = self::normaliseEmail($input['email'] ?? null);
        $password = $input['password'] ?? null;
        if (($locked = $this->lockSecondsLeft($email, $ip)) > 0) {
            throw ApiException::locked((int) ceil($locked / 60));
        }

        $found = $email === '' ? null : $this->users->findWithHashByEmail($email);
        if ($found === null || !is_string($password) || !password_verify($password, $found[1])) {
            $this->failLogin($email, $ip);
        }
        [$user, , $verified] = $found;

        if (!$verified) {
            $language = in_array($input['language'] ?? null, self::LANGUAGES, true) ? $input['language'] : $user->language;
            if ($this->secondsUntilNextCode($email) === 0 && !$this->codesPerHourReached($email)) {
                $this->transaction(fn () => $this->sendCode($user->id, $email, $user->displayName, $language, $ip));
            }
            $times = $this->codeTimes($email);
            throw ApiException::unverified($times['code_minutes'], $times['resend_in_seconds']);
        }

        $this->users->touchLastLogin($user->id);
        $this->events->add('login', $email, $ip, $this->now());

        return [$this->startSession($user->id), $user];
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

    /** Records a failed login, locks the email for this IP at the 3rd failure in the window, and answers. */
    private function failLogin(string $email, string $ip): never
    {
        $now = $this->now();
        $this->events->add('login_failed', $email, $ip, $now);
        $lastLock = $this->events->lastAt(['locked'], $email, $ip);
        $since = max($this->ago($this->settings->failureWindow), $lastLock === null ? '' : self::plus($lastLock, $this->settings->lock));
        if ($this->events->count(['login_failed'], $since, $email, $ip) >= self::FAILURES_TO_LOCK) {
            $this->events->add('locked', $email, $ip, $now);
            throw ApiException::locked((int) ceil($this->settings->lock / 60));
        }
        throw UnauthorizedException::invalidCredentials();
    }

    private function lockSecondsLeft(string $email, string $ip): int
    {
        $lastLock = $this->events->lastAt(['locked'], $email, $ip);

        return $lastLock === null ? 0 : max(0, self::seconds(self::plus($lastLock, $this->settings->lock)) - self::seconds($this->now()));
    }

    /** A new 6-digit code for an unverified account, emailed in $language; the old code stops working. */
    private function sendCode(int $userId, string $email, string $name, string $language, string $ip): void
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->codes->replace($userId, self::hash($code), self::CODE_TRIES, self::plus($this->now(), $this->settings->codeTtl));
        $this->events->add('code_sent', $email, $ip, $this->now());
        $this->mail->send($email, ...AuthEmails::code($language, $name, $code, $this->settings->codeMinutes()));
    }

    private function secondsUntilNextCode(string $email): int
    {
        $last = $this->events->lastAt(self::CODE_EVENTS, $email);

        return $last === null ? 0 : max(0, self::seconds(self::plus($last, $this->settings->resendGap)) - self::seconds($this->now()));
    }

    private function codesPerHourReached(string $email): bool
    {
        return $this->events->count(self::CODE_EVENTS, $this->ago(3600), $email) >= self::CODES_PER_HOUR;
    }

    /** @return array{code_minutes: int, resend_in_seconds: int} */
    private function codeTimes(string $email): array
    {
        return ['code_minutes' => $this->settings->codeMinutes(), 'resend_in_seconds' => $this->secondsUntilNextCode($email)];
    }

    /** @param array<string, int> $params */
    private static function codeError(string $code, string $message, array $params = []): ValidationException
    {
        return new ValidationException(['code' => ['code' => $code, 'message' => $message] + ($params === [] ? [] : ['params' => $params])]);
    }

    /**
     * Runs $work in one transaction; on any error (also a mail that cannot be sent) nothing is saved.
     * @template T
     * @param callable(): T $work
     * @return T
     */
    private function transaction(callable $work): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $result = $work();
            $this->pdo->commit();

            return $result;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    private function now(): string
    {
        return $this->clock->now()->format(self::TIME_FORMAT);
    }

    private function ago(int $seconds): string
    {
        return $this->clock->now()->modify("-{$seconds} seconds")->format(self::TIME_FORMAT);
    }

    private static function plus(string $time, int $seconds): string
    {
        return (new \DateTimeImmutable($time, new \DateTimeZone('UTC')))->modify("+{$seconds} seconds")->format(self::TIME_FORMAT);
    }

    private static function seconds(string $time): int
    {
        return (new \DateTimeImmutable($time, new \DateTimeZone('UTC')))->getTimestamp();
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
