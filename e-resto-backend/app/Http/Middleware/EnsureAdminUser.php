<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || $user->restaurant_id || !$user->hasRole('admin')) {
            return response()->json([
                'message' => 'Acces reserve aux administrateurs de la plateforme.',
            ], 403);
        }

        return $next($request);
    }
}
