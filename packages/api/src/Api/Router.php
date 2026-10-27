<?php

declare(strict_types=1);

namespace App\Api;

use App\Service\ForbiddenException;
use App\Service\NotFoundException;
use App\Service\UnauthorizedException;
use App\Service\ValidationException;

final class Router
{
    /** @var list<array{string, string, callable(Request, array<string, string>): JsonResponse}> */
    private array $routes = [];

    /** @param callable(Request, array<string, string>): JsonResponse $handler */
    public function add(string $method, string $pattern, callable $handler): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?<$1>\d+)', $pattern) . '$#';
        $this->routes[] = [$method, $regex, $handler];
    }

    public function dispatch(Request $request): JsonResponse
    {
        if ($request->method === 'OPTIONS') {
            return new JsonResponse(204);
        }

        try {
            $pathMatched = false;
            foreach ($this->routes as [$method, $regex, $handler]) {
                if (preg_match($regex, $request->path, $matches) !== 1) {
                    continue;
                }
                $pathMatched = true;
                if ($method === $request->method) {
                    return $handler($request, array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY));
                }
            }

            return $pathMatched
                ? self::error(405, 'method_not_allowed', 'Method not allowed.')
                : self::error(404, 'not_found', 'Not found.');
        } catch (ValidationException $e) {
            return new JsonResponse(422, ['errors' => $e->errors]);
        } catch (UnauthorizedException $e) {
            return self::error(401, $e->errorCode, $e->getMessage());
        } catch (ForbiddenException $e) {
            return self::error(403, 'not_a_member', $e->getMessage());
        } catch (NotFoundException $e) {
            return self::error(404, 'not_found', $e->getMessage());
        } catch (\JsonException) {
            return self::error(400, 'invalid_json', 'The request body must be a JSON object.');
        } catch (\Throwable $e) {
            error_log((string) $e);
            return self::error(500, 'server_error', 'Something went wrong.');
        }
    }

    private static function error(int $status, string $code, string $message): JsonResponse
    {
        return new JsonResponse($status, ['error' => ['code' => $code, 'message' => $message]]);
    }
}
