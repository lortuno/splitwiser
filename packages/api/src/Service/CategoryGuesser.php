<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\Category;

/**
 * Guesses a category from an expense name, without any service outside the app. Words are read from left to right;
 * at each position a two-word phrase, then the exact word, then the word with typos is tried, and the first position
 * that matches decides. Typos: none under 5 letters, 1 edit for 5–7 letters, 2 edits for 8 or more (levenshtein).
 */
final class CategoryGuesser
{
    private const int MIN_TYPO_LENGTH = 5;

    private const array ACCENTS = [
        'à' => 'a', 'á' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'å' => 'a', 'æ' => 'ae', 'ç' => 'c',
        'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e', 'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i',
        'ñ' => 'n', 'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o', 'ø' => 'o', 'œ' => 'oe',
        'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u', 'ý' => 'y', 'ÿ' => 'y', 'ß' => 'ss',
    ];

    /** @var array<string, string>|null word => category code */
    private static ?array $words = null;

    /**
     * The name as compared for learning and matching: lowercase, accents stripped, every character that is not a
     * letter or digit a space, spaces collapsed. "Gasolina  Repsol!" -> "gasolina repsol".
     */
    public static function nameKey(string $name): string
    {
        $key = strtr(mb_strtolower($name), self::ACCENTS);
        if (preg_match('/[^\x00-\x7F]/', $key) === 1) {
            $key = (string) @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $key);
        }

        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $key));
    }

    /** The keyword guess, or null when no word matched. */
    public function guess(string $name): ?Category
    {
        $words = array_values(array_filter(
            explode(' ', self::nameKey($name)),
            static fn (string $w): bool => $w !== '' && !in_array($w, CategoryKeywords::FILLER, true),
        ));

        foreach ($words as $i => $word) {
            $code = CategoryKeywords::PHRASES[$word . ' ' . ($words[$i + 1] ?? '')]
                ?? self::words()[$word]
                ?? self::closest($word);
            if ($code !== null) {
                return Category::from($code);
            }
        }

        return null;
    }

    /** The category of the keyword nearest to $word within the allowed typos; ties go to the earlier keyword. */
    private static function closest(string $word): ?string
    {
        $length = strlen($word);
        if ($length < self::MIN_TYPO_LENGTH) {
            return null;
        }
        $best = null;
        $bestDistance = $length >= 8 ? 2 : 1;
        foreach (self::words() as $keyword => $code) {
            if (strlen($keyword) < self::MIN_TYPO_LENGTH || abs(strlen($keyword) - $length) > $bestDistance) {
                continue;
            }
            $distance = levenshtein($word, $keyword);
            if ($distance <= $bestDistance && ($best === null || $distance < $bestDistance)) {
                [$best, $bestDistance] = [$code, $distance];
            }
        }

        return $best;
    }

    /** @return array<string, string> */
    private static function words(): array
    {
        if (self::$words === null) {
            self::$words = [];
            foreach (CategoryKeywords::WORDS as $code => $list) {
                foreach ($list as $word) {
                    self::$words[$word] ??= $code;
                }
            }
        }

        return self::$words;
    }
}
