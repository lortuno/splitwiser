<?php

declare(strict_types=1);

namespace App\Mail;

use App\Service\ApiException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\Transport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/** Sends plain-text emails over the SMTP server of MAILER_DSN (Mailpit locally). A failure is 503 mail_unavailable. */
final class MailSender
{
    private ?Transport\TransportInterface $transport = null;

    public function __construct(private readonly string $dsn, private readonly string $from)
    {
    }

    public function send(string $to, string $subject, string $body): void
    {
        $email = (new Email())->from(Address::create($this->from))->to($to)->subject($subject)->text($body);
        try {
            $this->transport ??= Transport::fromDsn($this->dsn);
            $this->transport->send($email);
        } catch (TransportExceptionInterface) {
            throw ApiException::mailUnavailable();
        }
    }
}
