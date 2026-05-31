<?php

namespace App\Http\Controllers\tables;

use App\Http\Controllers\Controller;
use App\Models\Table;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class TableController extends Controller
{
    public function store(Request $request)
    {
        $restaurant = $request->user()?->restaurant;

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'capacity' => 'required|integer|min:1',
            'server_phone' => 'nullable|string|max:20',
        ]);

        if ($restaurant && $restaurant->plan && $restaurant->tables()->count() >= $restaurant->plan->max_tables) {
            return response()->json([
                'message' => "Limite de tables atteinte pour le plan {$restaurant->plan->name}.",
            ], 422);
        }

        $table = Table::create([
            'restaurant_id' => $restaurant?->id,
            'name' => $validated['name'],
            'capacity' => $validated['capacity'],
            'status' => 'Libre',
            'server_phone' => $validated['server_phone'] ?? null,
        ]);

        $frontendUrl = rtrim(env('CLIENT_FRONTEND_URL', 'http://192.168.1.67:5173'), '/');
        $url = "{$frontendUrl}/?table_id={$table->id}";

        $qrImage = QrCode::format('svg')
            ->size(400)
            ->errorCorrection('H')
            ->margin(2)
            ->generate($url);

        $qrPath = "qrcodes/table_{$table->id}.svg";
        if (!Storage::disk('public')->exists('qrcodes')) {
            Storage::disk('public')->makeDirectory('qrcodes');
        }
        Storage::disk('public')->put($qrPath, $qrImage);

        $table->update(['qr_code' => $qrPath]);

        return response()->json([
            'message' => 'Table creee avec succes',
            'table' => $this->tablePayload($table),
            'qr_url' => asset("storage/{$qrPath}"),
            'menu_url' => $url,
        ], 201);
    }

    public function index(Request $request)
    {
        $tables = $this->scopedTables($request)
            ->latest()
            ->get()
            ->map(fn ($table) => $this->tablePayload($table));

        return response()->json($tables);
    }

    public function show(Request $request, $id)
    {
        $table = $this->scopedTables($request)->findOrFail($id);

        return response()->json($this->tablePayload($table));
    }

    public function update(Request $request, $id)
    {
        $table = $this->scopedTables($request)->findOrFail($id);
        $table->update($request->only(['name', 'capacity', 'server_phone', 'status']));

        return response()->json([
            'message' => 'Table mise a jour',
            'table' => $this->tablePayload($table->fresh()),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $table = $this->scopedTables($request)->findOrFail($id);
        $table->delete();

        return response()->json(['message' => 'Table supprimee']);
    }

    private function scopedTables(Request $request)
    {
        return Table::query()
            ->when($request->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId));
    }

    private function tablePayload(Table $table): array
    {
        return [
            'id' => $table->id,
            'restaurant_id' => $table->restaurant_id,
            'name' => $table->name,
            'capacity' => $table->capacity,
            'status' => $table->status,
            'server_phone' => $table->server_phone,
            'status_color' => match ($table->status) {
                'Libre' => 'green',
                'Occupee', 'Occupée' => 'yellow',
                'Reservee', 'Réservée' => 'blue',
                default => 'gray',
            },
            'qr_url' => $table->qr_code ? asset("storage/{$table->qr_code}") : null,
            'menu_url' => rtrim(env('CLIENT_FRONTEND_URL', 'http://localhost:5173'), '/') . "/?table_id={$table->id}",
            'created_at' => $table->created_at?->toIso8601String(),
            'updated_at' => $table->updated_at?->toIso8601String(),
        ];
    }
}
