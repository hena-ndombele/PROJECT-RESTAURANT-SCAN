<?php

namespace App\Http\Controllers\tables;

use App\Http\Controllers\Controller;
use App\Models\Table;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class TableController extends Controller
{
    public function store(Request $request)
    {
        $restaurant = $request->user()?->restaurant;

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('tables', 'name')->where(fn ($query) => $query->where('restaurant_id', $restaurant?->id)),
            ],
            'capacity' => 'required|integer|min:1',
            'server_phone' => 'nullable|string|max:20',
        ], [
            'name.unique' => 'Ce nom de table existe déjà.',
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
            'qr_url' => $this->publicStorageUrl($qrPath),
            'menu_url' => $url,
        ], 201);
    }

    public function index(Request $request)
    {
        $this->attachLegacyTablesToCurrentRestaurant($request);

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

    public function qrCode(string $filename)
    {
        if (!preg_match('/^table_[A-Za-z0-9\-]+\.svg$/', $filename)) {
            abort(404);
        }

        $tableId = substr($filename, strlen('table_'), -strlen('.svg'));
        $table = Table::with('restaurant')->find($tableId);
        if ($table) {
            $currentPath = $this->generateTableQrCode($table, $this->menuUrl($table));
            if ($table->qr_code !== $currentPath) {
                $table->update(['qr_code' => $currentPath]);
            }
        }

        $path = "qrcodes/{$filename}";
        if (!Storage::disk('public')->exists($path)) {
            abort(404);
        }

        return response(Storage::disk('public')->get($path), 200, [
            'Content-Type' => 'image/svg+xml',
            'Cache-Control' => 'public, max-age=31536000',
        ]);
    }
    public function update(Request $request, $id)
    {
        $table = $this->scopedTables($request)->findOrFail($id);
        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('tables', 'name')
                    ->where(fn ($query) => $query->where('restaurant_id', $request->user()?->restaurant_id))
                    ->ignore($table->id),
            ],
            'capacity' => 'sometimes|required|integer|min:1',
            'server_phone' => 'nullable|string|max:20',
            'status' => 'sometimes|string|max:50',
        ], [
            'name.unique' => 'Ce nom de table existe déjà.',
        ]);

        $table->update($validated);

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
            ->where('name', '!=', 'Commandes hors restaurant')
            ->when($request->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId));
    }

    private function attachLegacyTablesToCurrentRestaurant(Request $request): void
    {
        $restaurantId = $request->user()?->restaurant_id;
        if (!$restaurantId) {
            return;
        }

        if (Table::where('restaurant_id', $restaurantId)->exists()) {
            return;
        }

        $usedNames = [];
        Table::whereNull('restaurant_id')->oldest()->get()->each(function (Table $table) use ($restaurantId, &$usedNames) {
            $nameKey = mb_strtolower(trim((string) $table->name));
            if ($nameKey === '' || isset($usedNames[$nameKey])) {
                return;
            }

            $table->restaurant_id = $restaurantId;
            $table->save();
            $usedNames[$nameKey] = true;
        });
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
            'qr_url' => $table->qr_code ? $this->publicStorageUrl($table->qr_code) : null,
            'menu_url' => $this->menuUrl($table),
            'created_at' => $table->created_at?->toIso8601String(),
            'updated_at' => $table->updated_at?->toIso8601String(),
        ];
    }

    private function publicStorageUrl(string $path): string
    {
        return rtrim(request()->getSchemeAndHttpHost(), '/') . '/api/table-qrcodes/' . rawurlencode(basename($path));
    }
    private function menuUrl(Table $table): string
    {
        $query = ['table_id' => $table->id];
        $slug = $table->restaurant?->slug;
        if ($slug) {
            $query['restaurant_slug'] = $slug;
        }

        return rtrim(env('CLIENT_FRONTEND_URL', 'http://192.168.1.73:5173'), '/') . '/?' . http_build_query($query);
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
