<?php

declare(strict_types=1);

namespace App\Service;

/** 403: the trip exists, but the logged-in user is not one of its members. */
final class ForbiddenException extends \RuntimeException
{
}
