<?php

declare(strict_types=1);

namespace App;

/**
 * The app has exactly one currency. All amounts are integer euro cents.
 */
final class Money
{
    public const string CURRENCY = 'EUR';

    /** Formats cents for human-readable messages, e.g. 123456 -> "1.234,56 €". */
    public static function format(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $abs = abs($cents);
        $euros = number_format(intdiv($abs, 100), 0, ',', '.');

        return sprintf('%s%s,%02d €', $sign, $euros, $abs % 100);
    }
}
