<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Words that point to a category, in English, German, Spanish and French plus brand names, written as name keys
 * (lowercase, no accents: see CategoryGuesser::nameKey). Every word belongs to exactly one category.
 * Deliberately missing: "airport" (a place, not a category), "port" (would match "Porto"), "boat" (a boat tour is an
 * activity, a ferry is transport), "total" (French fuel brand, but also an ordinary word) and "air". Add a word here and an entry to CategoryGuesserTest whenever a wrong guess is reported.
 */
final class CategoryKeywords
{
    /** Two-word phrases, checked before single words. */
    public const array PHRASES = [
        'gas station' => 'fuel',
        'petrol station' => 'fuel',
        'car rental' => 'transport',
        'rental car' => 'transport',
        'sleeper train' => 'transport',
        'night train' => 'transport',
        'boat tour' => 'activities',
        'boat trip' => 'activities',
        'ice cream' => 'coffee',
        'petit dejeuner' => 'food',
        'visite guidee' => 'activities',
        'air france' => 'flights',
    ];

    /** @var array<string, list<string>> category code => words */
    public const array WORDS = [
        'food' => [
            'restaurant', 'restaurante', 'dinner', 'lunch', 'breakfast', 'brunch', 'meal', 'food', 'pizza', 'pizzeria',
            'burger', 'tapas', 'seafood', 'sushi', 'paella', 'kebab', 'bistro', 'diner', 'buffet', 'steak', 'pasta',
            'tacos', 'takeaway', 'picnic', 'menu', 'mcdonalds', 'abendessen', 'mittagessen', 'fruhstuck', 'essen',
            'imbiss', 'gaststatte', 'cena', 'comida', 'almuerzo', 'desayuno', 'dejeuner', 'repas',
        ],
        'groceries' => [
            'groceries', 'grocery', 'supermarket', 'market', 'lidl', 'aldi', 'rewe', 'edeka', 'carrefour', 'mercadona',
            'spar', 'supermarkt', 'lebensmittel', 'einkauf', 'supermercado', 'mercado', 'compra', 'alimentacion',
            'courses', 'supermarche', 'intermarche', 'leclerc',
        ],
        'drinks' => [
            'drinks', 'drink', 'beer', 'beers', 'wine', 'cocktail', 'cocktails', 'bar', 'pub', 'club', 'nightclub',
            'bier', 'wein', 'getranke', 'kneipe', 'bebidas', 'cerveza', 'cervezas', 'vino', 'copa', 'copas', 'sangria',
            'biere', 'bieres', 'vin', 'apero',
        ],
        'coffee' => [
            'coffee', 'cafe', 'cafes', 'starbucks', 'espresso', 'cappuccino', 'latte', 'bakery', 'snack', 'snacks',
            'ice', 'icecream', 'kaffee', 'kuchen', 'backerei', 'eis', 'cafeteria', 'churros', 'helado', 'panaderia',
            'pasteleria', 'boulangerie', 'croissant', 'croissants', 'glace',
        ],
        'fuel' => [
            'gasoline', 'gas', 'petrol', 'fuel', 'diesel', 'benzin', 'tanken', 'tankstelle', 'gasolina', 'gasolinera',
            'gasoil', 'shell', 'repsol', 'aral', 'esso', 'cepsa', 'galp', 'bp', 'essence', 'carburant', 'gazole',
            'totalenergies',
        ],
        'transport' => [
            'taxi', 'uber', 'bolt', 'cabify', 'train', 'trains', 'tram', 'metro', 'subway', 'bus', 'coach', 'ferry',
            'tube', 'rental', 'car', 'toll', 'parking', 'shuttle', 'transfer', 'scooter', 'bike', 'sixt', 'hertz',
            'europcar', 'avis', 'flixbus', 'renfe', 'bahn', 'zug', 'ubahn', 'sbahn', 'strassenbahn', 'fahrkarte',
            'mietwagen', 'maut', 'parken', 'parkhaus', 'tren', 'autobus', 'alquiler', 'coche', 'peaje', 'aparcamiento',
            'peage', 'autoroute', 'navette', 'sncf', 'tgv',
        ],
        'flights' => [
            'flight', 'flights', 'jet', 'plane', 'airline', 'airlines', 'boarding', 'ryanair', 'vueling', 'easyjet',
            'lufthansa', 'iberia', 'eurowings', 'wizz', 'flug', 'fluge', 'flugzeug', 'vuelo', 'vuelos', 'avion', 'vol',
            'vols',
        ],
        'lodging' => [
            'hotel', 'hotels', 'hostel', 'motel', 'inn', 'airbnb', 'booking', 'apartment', 'camping', 'campsite',
            'accommodation', 'room', 'resort', 'guesthouse', 'unterkunft', 'ferienwohnung', 'pension', 'zimmer',
            'alojamiento', 'apartamento', 'hostal', 'habitacion', 'gite', 'logement',
        ],
        'activities' => [
            'tickets', 'ticket', 'entrance', 'entry', 'admission', 'museum', 'museums', 'tour', 'tours', 'excursion',
            'guide', 'concert', 'theatre', 'theater', 'cinema', 'show', 'park', 'zoo', 'aquarium', 'ski', 'skipass',
            'spa', 'yacht', 'castle', 'kayak', 'surf', 'diving', 'tasting', 'festival', 'stadium', 'golf', 'hike',
            'eintritt', 'museen', 'ausflug', 'fuhrung', 'kino', 'schloss', 'konzert', 'entrada', 'entradas', 'museo',
            'visita', 'teatro', 'cine', 'castillo', 'concierto', 'musee', 'billet', 'billets', 'entree', 'visite',
        ],
        'shopping' => [
            'shopping', 'souvenir', 'souvenirs', 'gift', 'gifts', 'clothes', 'clothing', 'shoes', 'pharmacy',
            'sunscreen', 'drugstore', 'store', 'shop', 'mall', 'boutique', 'zara', 'primark', 'apotheke', 'drogerie',
            'rossmann', 'kleidung', 'schuhe', 'geschenk', 'geschenke', 'farmacia', 'regalo', 'regalos', 'ropa',
            'zapatos', 'tienda', 'compras', 'pharmacie', 'cadeau', 'cadeaux', 'vetements',
        ],
    ];

    /** Dropped before matching. */
    public const array FILLER = [
        'a', 'an', 'and', 'at', 'for', 'from', 'in', 'of', 'on', 'the', 'to', 'with',
        'am', 'auf', 'das', 'der', 'die', 'fur', 'im', 'mit', 'und', 'vom', 'zum', 'zur',
        'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'para', 'por', 'un', 'una', 'y',
        'au', 'aux', 'avec', 'chez', 'des', 'du', 'et', 'le', 'les', 'pour', 'sur',
    ];
}
