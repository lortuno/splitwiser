<?php

declare(strict_types=1);

namespace App\Dto;

enum SplitType: string
{
    case Equal = 'equal';
    case Exact = 'exact';
    case Percentage = 'percentage';
    case Shares = 'shares';
}
