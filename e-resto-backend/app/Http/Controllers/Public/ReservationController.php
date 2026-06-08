<?php

namespace App\Http\Controllers\Public;

use App\Events\ReservationCreated;
use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\Restaurant;
use App\Models\Table;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReservationController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'table_id' => 'nullable|uuid|exists:tables,id',
            'restaurant_id' => 'nullable|uuid|exists:restaurants,id',
            'restaurant_slug' => 'nullable|string|exists:restaurants,slug',
            'name' => 'required|string|max:150',
            'phone' => 'required|string|max:30',
            'email' => 'required|email|max:190',
            'guests' => 'required|integer|min:1|max:50',
            'reservation_date' => 'required|date|after_or_equal:today',
            'reservation_time' => 'required|date_format:H:i',
            'special_requests' => 'nullable|string|max:2000',
        ]);

        return DB::transaction(function () use ($validated) {
            $table = !empty($validated['table_id']) ? Table::with('restaurant.plan')->find($validated['table_id']) : null;
            $restaurant = $table?->restaurant
                ?? (!empty($validated['restaurant_id']) ? Restaurant::with('plan')->find($validated['restaurant_id']) : null)
                ?? (!empty($validated['restaurant_slug']) ? Restaurant::with('plan')->where('slug', $validated['restaurant_slug'])->first() : null);

            if (!$restaurant || !in_array($restaurant->status, ['active', 'trial'], true)) {
                return response()->json([
                    'message' => 'Ce restaurant ne prend pas de reservations pour le moment.',
                ], 422);
            }

            if (!$restaurant->plan?->allows('reservations')) {
                return response()->json([
                    'message' => 'Les reservations sont reservees aux plans Pro et Business.',
                    'requires_upgrade' => true,
                ], 403);
            }

            $reservation = Reservation::create([
                'restaurant_id' => $restaurant->id,
                'table_id' => $table?->id,
                'name' => $validated['name'],
                'phone' => $validated['phone'],
                'email' => $validated['email'],
                'guests' => $validated['guests'],
                'reservation_date' => $validated['reservation_date'],
                'reservation_time' => $validated['reservation_time'],
                'special_requests' => $validated['special_requests'] ?? null,
                'status' => 'pending',
                'source' => 'qr_client',
            ]);

            broadcast(new ReservationCreated($reservation))->toOthers();

            return response()->json([
                'message' => 'Demande de reservation envoyee. Le restaurant va confirmer la disponibilite.',
                'data' => $reservation->load(['table', 'restaurant']),
            ], 201);
        });
    }

    public function index(Request $request)
    {
        $restaurantId = $request->user()?->restaurant_id;
        $restaurant = $restaurantId ? Restaurant::with('plan')->find($restaurantId) : null;

        if ($restaurant && !$restaurant->plan?->allows('reservations')) {
            return response()->json([
                'message' => 'Les reservations sont reservees aux plans Pro et Business.',
                'requires_upgrade' => true,
            ], 403);
        }

        $query = Reservation::with(['table', 'restaurant'])
            ->when($restaurantId, fn ($builder) => $builder->where('restaurant_id', $restaurantId))
            ->latest('reservation_date')
            ->latest('reservation_time');

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('date')) {
            $query->whereDate('reservation_date', $request->date);
        }

        return response()->json($query->get());
    }

    public function updateStatus(Request $request, string $id)
    {
        $validated = $request->validate([
            'status' => 'required|string|in:pending,confirmed,seated,completed,cancelled,no_show',
            'internal_note' => 'nullable|string|max:2000',
            'cancellation_reason' => 'nullable|string|max:1000|required_if:status,cancelled',
        ]);

        return DB::transaction(function () use ($request, $id, $validated) {
            $reservation = Reservation::with('table')
                ->when($request->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId))
                ->lockForUpdate()
                ->findOrFail($id);

            $updates = [
                'status' => $validated['status'],
                'internal_note' => $validated['internal_note'] ?? $reservation->internal_note,
                'cancellation_reason' => $validated['cancellation_reason'] ?? null,
            ];

            if ($validated['status'] === 'confirmed') {
                $updates['confirmed_at'] = now();
                $reservation->table?->update(['status' => Table::STATUS_RESERVED]);
            }
            if ($validated['status'] === 'seated') {
                $updates['seated_at'] = now();
                $reservation->table?->update(['status' => Table::STATUS_OCCUPIED]);
            }
            if (in_array($validated['status'], ['completed', 'cancelled', 'no_show'], true)) {
                $updates['completed_at'] = $validated['status'] === 'completed' ? now() : $reservation->completed_at;
                $reservation->table?->update(['status' => Table::STATUS_FREE]);
            }

            $reservation->update($updates);

            return response()->json([
                'message' => 'Reservation mise a jour.',
                'data' => $reservation->fresh(['table', 'restaurant']),
            ]);
        });
    }

    public function destroy(Request $request, string $id)
    {
        $reservation = Reservation::query()
            ->when($request->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId))
            ->findOrFail($id);

        $reservation->delete();

        return response()->json(['message' => 'Reservation supprimee.']);
    }
}
