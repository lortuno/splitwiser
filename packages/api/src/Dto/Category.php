<?php

declare(strict_types=1);

namespace App\Dto;

/** What an expense was for. The app shows each one as an emoji; "other" is the fallback. Order = the form's order. */
enum Category: string
{
    case Food = 'food';
    case Groceries = 'groceries';
    case Drinks = 'drinks';
    case Coffee = 'coffee';
    case Fuel = 'fuel';
    case Transport = 'transport';
    case Flights = 'flights';
    case Lodging = 'lodging';
    case Activities = 'activities';
    case Shopping = 'shopping';
    case Other = 'other';
}
