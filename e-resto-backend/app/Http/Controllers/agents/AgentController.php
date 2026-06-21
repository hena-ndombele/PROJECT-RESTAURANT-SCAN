<?php

namespace App\Http\Controllers\agents;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class AgentController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|email|unique:agents,email',
            'phone_number' => 'required|string|max:60',
            'address' => 'required|string',
            'education_level' => 'nullable|string|max:255',
            'fonction' => 'required|string|max:255',
            'matricule' => 'required|string|max:60|unique:agents,matricule',
            'photo' => 'nullable|image|max:2048',
            'department' => 'nullable|string|max:255',
            'status' => 'nullable|string|max:30',
            'contract_type' => 'nullable|string|max:60',
            'shift' => 'nullable|string|max:60',
            'hired_at' => 'nullable|date',
            'emergency_contact_name' => 'nullable|string|max:255',
            'emergency_contact_phone' => 'nullable|string|max:60',
        ]);

        try {
            $result = DB::transaction(function () use ($request, $validated) {
                $restaurant = $request->user()?->restaurant;
                $restaurantId = $request->user()?->restaurant_id;
                $photoPath = null;

                if ($request->hasFile('photo')) {
                    $photoPath = $request->file('photo')->store("agents/{$restaurantId}", 'public');
                }

                $agent = Agent::create([
                    'restaurant_id' => $restaurantId,
                    'user_id' => null,
                    'matricule' => $validated['matricule'],
                    'first_name' => $validated['first_name'],
                    'last_name' => $validated['last_name'],
                    'email' => $validated['email'],
                    'photo' => $photoPath,
                    'phone_number' => $validated['phone_number'],
                    'address' => $validated['address'],
                    'education_level' => $validated['education_level'] ?? null,
                    'fonction' => $validated['fonction'],
                    'department' => $validated['department'] ?? null,
                    'status' => $validated['status'] ?? 'active',
                    'contract_type' => $validated['contract_type'] ?? null,
                    'shift' => $validated['shift'] ?? null,
                    'hired_at' => $validated['hired_at'] ?? null,
                    'emergency_contact_name' => $validated['emergency_contact_name'] ?? null,
                    'emergency_contact_phone' => $validated['emergency_contact_phone'] ?? null,
                ]);

                $agent = $agent->fresh();

                return [
                    'agent' => $agent,
                    'qr_code' => $this->agentQrCode($agent),
                ];
            });

            return response()->json([
                'status' => 'success',
                'message' => 'Employe cree avec succes',
                'agent' => $this->agentPayload($result['agent']),
                'qr_code' => $result['qr_code'],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Erreur lors de la creation de l agent.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function index()
    {
        try {
            $agents = Agent::query()
                ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
                ->latest()
                ->get()
                ->map(fn (Agent $agent) => $this->agentPayload($agent));

            return response()->json([
                'success' => true,
                'data' => $agents,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la recuperation des agents',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function show($id)
    {
        $agent = Agent::query()
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->find($id);

        if (!$agent) {
            return response()->json(['message' => 'Agent non trouve'], 404);
        }

        $payload = $this->agentPayload($agent);
        $payload['photo_data_url'] = $this->publicDiskDataUrl($agent->photo);

        return response()->json([
            'agent' => $payload,
            'restaurant' => [
                'name' => $agent->restaurant?->name,
                'logo_data_url' => $this->publicDiskDataUrl($agent->restaurant?->logo),
            ],
            'qr_code' => $this->agentQrCode($agent),
        ], 200);
    }

    public function verify(Request $request, $id)
    {
        $agent = Agent::with('restaurant')->find($id);

        if (!$agent) {
            return response()->json(['message' => 'Employe introuvable.'], 404);
        }

        if (!hash_equals($this->verificationToken($agent), (string) $request->query('token'))) {
            return response()->json(['message' => 'QR code invalide ou non autorise.'], 403);
        }

        return response()->json([
            'valid' => true,
            'employee' => [
                'id' => $agent->id,
                'matricule' => $agent->matricule,
                'first_name' => $agent->first_name,
                'last_name' => $agent->last_name,
                'full_name' => trim($agent->first_name . ' ' . $agent->last_name),
                'fonction' => $agent->fonction,
                'status' => $agent->status ?: 'active',
                'is_active' => strtolower($agent->status ?: 'active') === 'active',
                'email' => $agent->email,
                'phone_number' => $agent->phone_number,
                'address' => $agent->address,
                'education_level' => $agent->education_level,
                'contract_type' => $agent->contract_type,
                'shift' => $agent->shift,
                'emergency_contact_name' => $agent->emergency_contact_name,
                'emergency_contact_phone' => $agent->emergency_contact_phone,
                'has_user_account' => (bool) $agent->user_id,
                'photo_url' => $agent->photo_url,
                'hired_at' => $agent->hired_at?->toDateString(),
                'created_at' => $agent->created_at?->toIso8601String(),
                'updated_at' => $agent->updated_at?->toIso8601String(),
            ],
            'restaurant' => [
                'id' => $agent->restaurant?->id,
                'name' => $agent->restaurant?->name,
                'owner_name' => $agent->restaurant?->owner_name,
                'owner_phone' => $agent->restaurant?->owner_phone,
                'address' => $agent->restaurant?->address,
                'city' => $agent->restaurant?->city,
                'country' => $agent->restaurant?->country,
                'logo_url' => $agent->restaurant?->logo ? asset("storage/{$agent->restaurant->logo}") : null,
            ],
            'verified_at' => now()->toIso8601String(),
        ]);
    }

    public function update(Request $request, $id)
    {
        $agent = Agent::query()
            ->when($request->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->find($id);

        if (!$agent) {
            return response()->json(['message' => 'Agent non trouve'], 404);
        }

        $validated = $request->validate([
            'first_name' => 'sometimes|required|string|max:255',
            'last_name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'email', Rule::unique('agents', 'email')->ignore($agent->id)],
            'phone_number' => 'sometimes|required|string|max:60',
            'address' => 'sometimes|required|string',
            'education_level' => 'nullable|string|max:255',
            'fonction' => 'sometimes|required|string|max:255',
            'matricule' => ['nullable', 'string', 'max:60', Rule::unique('agents', 'matricule')->ignore($agent->id)],
            'photo' => 'nullable|image|max:2048',
            'department' => 'nullable|string|max:255',
            'status' => 'nullable|string|max:30',
            'contract_type' => 'nullable|string|max:60',
            'shift' => 'nullable|string|max:60',
            'hired_at' => 'nullable|date',
            'emergency_contact_name' => 'nullable|string|max:255',
            'emergency_contact_phone' => 'nullable|string|max:60',
        ]);

        if ($request->hasFile('photo')) {
            $validated['photo'] = $request->file('photo')->store("agents/{$agent->restaurant_id}", 'public');
        }

        $agent->update($validated);

        if ($agent->user) {
            $agent->user->update([
                'first_name' => $agent->first_name,
                'last_name' => $agent->last_name,
                'email' => $agent->email,
                'phone_number' => $agent->phone_number,
                'address' => $agent->address,
            ]);
        }

        return response()->json([
            'message' => 'Agent mis a jour avec succes',
            'data' => $this->agentPayload($agent->fresh()),
        ], 200);
    }

    public function destroy($id)
    {
        $agent = Agent::query()
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->find($id);

        if (!$agent) {
            return response()->json(['message' => 'Agent non trouve'], 404);
        }

        $agent->delete();

        return response()->json(['message' => 'Agent supprime avec succes'], 200);
    }

    private function generateMatricule(?string $restaurantName): string
    {
        $prefix = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $restaurantName ?: 'RST'), 0, 3)) ?: 'RST';

        do {
            $matricule = $prefix . '-' . now()->format('ym') . '-' . strtoupper(Str::random(4));
        } while (Agent::where('matricule', $matricule)->exists());

        return $matricule;
    }

    private function agentQrCode(Agent $agent): string
    {
        $svg = QrCode::format('svg')
            ->size(260)
            ->errorCorrection('H')
            ->margin(1)
            ->generate($this->verificationUrl($agent));

        return 'data:image/svg+xml;base64,' . base64_encode($svg);
    }

    private function verificationUrl(Agent $agent): string
    {
        $frontendUrl = rtrim(env('RESTAURANT_ADMIN_URL', 'https://admin.restaurascan.com'), '/');

        return $frontendUrl . '/employee/verify/' . $agent->id . '?' . http_build_query([
            'token' => $this->verificationToken($agent),
        ]);
    }

    private function verificationToken(Agent $agent): string
    {
        return hash_hmac(
            'sha256',
            implode('|', [$agent->id, $agent->restaurant_id, $agent->matricule]),
            (string) config('app.key')
        );
    }

    private function publicDiskDataUrl(?string $path): ?string
    {
        if (!$path || !Storage::disk('public')->exists($path)) {
            return null;
        }

        $contents = Storage::disk('public')->get($path);
        $mimeType = Storage::disk('public')->mimeType($path) ?: 'image/png';

        return 'data:' . $mimeType . ';base64,' . base64_encode($contents);
    }

    private function agentPayload(Agent $agent): array
    {
        return [
            'id' => $agent->id,
            'restaurant_id' => $agent->restaurant_id,
            'user_id' => $agent->user_id,
            'matricule' => $agent->matricule,
            'first_name' => $agent->first_name,
            'last_name' => $agent->last_name,
            'email' => $agent->email,
            'photo' => $agent->photo,
            'photo_url' => $agent->photo_url,
            'phone_number' => $agent->phone_number,
            'address' => $agent->address,
            'education_level' => $agent->education_level,
            'fonction' => $agent->fonction,
            'department' => $agent->department,
            'status' => $agent->status,
            'contract_type' => $agent->contract_type,
            'shift' => $agent->shift,
            'hired_at' => $agent->hired_at?->toDateString(),
            'emergency_contact_name' => $agent->emergency_contact_name,
            'emergency_contact_phone' => $agent->emergency_contact_phone,
            'created_at' => $agent->created_at?->toIso8601String(),
            'updated_at' => $agent->updated_at?->toIso8601String(),
        ];
    }
}
