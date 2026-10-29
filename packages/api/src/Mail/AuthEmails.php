<?php

declare(strict_types=1);

namespace App\Mail;

/** The two sign-up emails in English, Spanish and French, as [subject, body]. */
final class AuthEmails
{
    /** @return array{string, string} */
    public static function code(string $language, string $name, string $code, int $minutes): array
    {
        $validity = match ($language) {
            'es' => $minutes === 1 ? '1 minuto' : "{$minutes} minutos",
            'fr' => $minutes === 1 ? '1 minute' : "{$minutes} minutes",
            default => $minutes === 1 ? '1 minute' : "{$minutes} minutes",
        };

        return match ($language) {
            'es' => ['Confirma tu correo', "Hola {$name}:\n\nTu código para Gastos de viaje es:\n\n    {$code}\n\nEs válido durante {$validity}. Si no te has registrado, puedes ignorar este correo.\n"],
            'fr' => ['Confirmez votre adresse e-mail', "Bonjour {$name},\n\nVotre code pour Frais de voyage est :\n\n    {$code}\n\nIl est valable {$validity}. Si vous ne vous êtes pas inscrit, vous pouvez ignorer cet e-mail.\n"],
            default => ['Confirm your email', "Hi {$name},\n\nYour code for Travel expenses is:\n\n    {$code}\n\nIt is valid for {$validity}. If you did not sign up,\nyou can ignore this email.\n"],
        };
    }

    /** @return array{string, string} */
    public static function alreadyRegistered(string $language, string $name): array
    {
        return match ($language) {
            'es' => ['Ya tienes una cuenta', "Hola {$name}:\n\nAlguien ha intentado registrarse en Gastos de viaje con este correo. Ya tienes una cuenta: inicia sesión con tu contraseña. Si no has sido tú, puedes ignorar este correo.\n"],
            'fr' => ['Vous avez déjà un compte', "Bonjour {$name},\n\nQuelqu’un a essayé de s’inscrire à Frais de voyage avec cette adresse. Vous avez déjà un compte : connectez-vous avec votre mot de passe. Si ce n’était pas vous, vous pouvez ignorer cet e-mail.\n"],
            default => ['You already have an account', "Hi {$name},\n\nSomeone tried to sign up for Travel expenses with this\nemail. You already have an account: log in with your\npassword. If it was not you, you can ignore this email.\n"],
        };
    }
}
