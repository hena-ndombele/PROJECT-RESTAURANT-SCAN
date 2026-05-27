<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\Table;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReservationController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'table_id' => 'nullable|uuid|exists:tables,id',
            'name' => 'required|string|max:150',
            'phone' => 'required|string|max:30',
            'email' => 'required|email|max:190',
            'guests' => 'required|integer|min:1|max:50',
            'reservation_date' => 'required|date|after_or_equal:today',
            'reservation_time' => 'required|date_format:H:i',
            'special_requests' => 'nullable|string|max:2000',
        ]);

        return DB::transaction(function () use ($validated) {
            $reservation = Reservation::create($validated + ['status' => 'pending']);

            if (!empty($validated['table_id'])) {
                Table::where('id', $validated['table_id'])->update(['status' => 'Reservee']);
            }

            return response()->json([
                'message' => 'Reservation enregistree avec succes',
                'data' => $reservation->load('table'),
            ], 201);
        });
    }
}
