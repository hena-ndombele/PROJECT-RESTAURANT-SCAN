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

        $tableLimit = $restaurant?->plan?->maxTables();
        if ($restaurant && $restaurant->plan && $tableLimit !== null && $restaurant->tables()->count() >= $tableLimit) {
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

        $url = $this->menuUrl($table);
        $qrPath = $this->generateTableQrCode($table, $url);

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
            'menu_url' => $this->menuUrl($table),
            'created_at' => $table->created_at?->toIso8601String(),
            'updated_at' => $table->updated_at?->toIso8601String(),
        ];
    }

    private function menuUrl(Table $table): string
    {
        $query = ['table_id' => $table->id];
        $slug = $table->restaurant?->slug;
        if ($slug) {
            $query['restaurant_slug'] = $slug;
        }

        return rtrim(env('CLIENT_FRONTEND_URL', 'http://localhost:5173'), '/') . '/?' . http_build_query($query);
    }

    private function generateTableQrCode(Table $table, string $url): string
    {
        $qrImage = QrCode::format('svg')
            ->size(400)
            ->errorCorrection('H')
            ->margin(2)
            ->generate($url);

        $qrImage = $this->injectRestaurantLogo($qrImage, $table);
        $qrPath = "qrcodes/table_{$table->id}.svg";
        if (!Storage::disk('public')->exists('qrcodes')) {
            Storage::disk('public')->makeDirectory('qrcodes');
        }
        Storage::disk('public')->put($qrPath, $qrImage);

        return $qrPath;
    }

    private function injectRestaurantLogo(string $svg, Table $table): string
    {
        $restaurant = $table->restaurant;
        if (!$restaurant?->logo || !Storage::disk('public')->exists($restaurant->logo)) {
            return $svg;
        }

        $logoPath = Storage::disk('public')->path($restaurant->logo);
        $mime = mime_content_type($logoPath) ?: 'image/png';
        $logoData = base64_encode((string) file_get_contents($logoPath));
        $logo = sprintf(
            '<rect x="154" y="154" width="92" height="92" rx="18" fill="#fff"/><image href="data:%s;base64,%s" x="164" y="164" width="72" height="72" preserveAspectRatio="xMidYMid meet"/>',
            $mime,
            $logoData
        );

        return str_replace('</svg>', $logo . '</svg>', $svg);
    }
}
