<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRestaurantUser
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user()?->restaurant_id) {
            return response()->json([
                'message' => 'Acces reserve aux utilisateurs restaurant.',
            ], 403);
        }

        return $next($request);
    }
}
