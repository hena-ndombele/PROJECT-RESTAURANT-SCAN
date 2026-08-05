<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Table;
use App\Models\TableSession;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TableSessionController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'table_id' => 'required|uuid|exists:tables,id',
        ]);

        return DB::transaction(function () use ($validated) {
            $table = Table::with('restaurant.plan')->lockForUpdate()->findOrFail($validated['table_id']);

            if (!$table->restaurant || !in_array($table->restaurant->status, ['active', 'trial'], true)) {
                return response()->json([
                    'message' => "Ce restaurant n'accepte pas de commandes pour le moment.",
                ], 403);
            }

            TableSession::query()
                ->where('table_id', $table->id)
                ->where('status', TableSession::STATUS_ACTIVE)
                ->where('expires_at', '<=', now())
                ->update([
                    'status' => TableSession::STATUS_EXPIRED,
                    'closed_at' => now(),
                ]);

            $session = TableSession::query()
                ->where('table_id', $table->id)
                ->where('status', TableSession::STATUS_ACTIVE)
                ->where('expires_at', '>', now())
                ->latest()
                ->first();

            if (!$session) {
                $session = TableSession::create([
                    'restaurant_id' => $table->restaurant_id,
                    'table_id' => $table->id,
                    'token' => Str::random(64),
                    'status' => TableSession::STATUS_ACTIVE,
                    'expires_at' => Carbon::now()->addHours(3),
                ]);
            }

            return response()->json([
                'message' => 'Session de table active.',
                'table_session' => [
                    'id' => $session->id,
                    'table_id' => $session->table_id,
                    'token' => $session->token,
                    'status' => $session->status,
                    'expires_at' => optional($session->expires_at)->toIso8601String(),
                    'duration_minutes' => 180,
                ],
            ], 201);
        });
    }
}
