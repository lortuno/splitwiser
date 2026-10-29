<?php

declare(strict_types=1);

namespace App;

/**
 * Mail and security settings from the environment, with the real values as defaults (feature 8, security). Durations
 * are in seconds; the e2e run sets short ones.
 */
final readonly class Settings
{
    public function __construct(
        public string $mailerDsn = 'smtp://mailpit:1025',
        public string $mailFrom = 'Travel expenses <no-reply@travel.local>',
        public string $appOrigin = 'http://localhost:8081',
        public int $codeTtl = 900,
        public int $resendGap = 60,
        public int $failureWindow = 120,
        public int $lock = 300,
    ) {
    }

    public static function fromEnvironment(): self
    {
        $defaults = new self();

        return new self(
            getenv('MAILER_DSN') ?: $defaults->mailerDsn,
            getenv('MAIL_FROM') ?: $defaults->mailFrom,
            getenv('APP_ORIGIN') ?: $defaults->appOrigin,
            (int) (getenv('AUTH_CODE_TTL') ?: $defaults->codeTtl),
            (int) (getenv('AUTH_RESEND_GAP') ?: $defaults->resendGap),
            (int) (getenv('AUTH_FAILURE_WINDOW') ?: $defaults->failureWindow),
            (int) (getenv('AUTH_LOCK') ?: $defaults->lock),
        );
    }

    /** The code's validity in whole minutes, rounded up, as the screens and emails show it. */
    public function codeMinutes(): int
    {
        return (int) ceil($this->codeTtl / 60);
    }
}
