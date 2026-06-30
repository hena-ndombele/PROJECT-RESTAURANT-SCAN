<?php

namespace App\Http\Controllers\users;

use App\Http\Controllers\Controller;
use App\Mail\AccountCreatedMail;
use App\Mail\RestaurantAccountCreatedMail;
use App\Mail\SendOtpMail;
use App\Models\Agent;
use App\Models\Otp;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Identifiants incorrects'], 401);
        }

        if (!$user->restaurant_id) {
            return response()->json(['message' => 'Ce compte utilisateur n est lie a aucun restaurant.'], 403);
        }

        $otpCode = rand(10000, 99999);
        Otp::where('user_id', $user->id)->delete();
        Otp::create([
            'user_id' => $user->id,
            'code' => $otpCode,
            'expires_at' => Carbon::now()->addMinutes(5),
        ]);

        $mailSent = true;
        try {
            Mail::to($user->email)->send(new SendOtpMail($otpCode));
        } catch (\Throwable) {
            $mailSent = false;
        }

      return response()->json([
    'message' => $mailSent
        ? 'Un code OTP a été envoyé à votre adresse e-mail.'
        : 'Le code OTP a été généré, mais l’e-mail n’a pas pu être envoyé.',
    'dev_otp' => app()->environment('local') && !$mailSent ? $otpCode : null,
]);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|digits:5',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !$user->restaurant_id) {
            return response()->json(['message' => 'Utilisateur introuvable'], 404);
        }

        $otp = Otp::where('user_id', $user->id)
            ->where('code', $request->otp)
            ->where('expires_at', '>=', Carbon::now())
            ->first();

        if (!$otp) {
            return response()->json(['message' => 'OTP invalide ou expire'], 400);
        }

        $otp->delete();

        $expiresAt = $this->tokenExpiresAt();
        $token = $user->createToken('API Token', ['*'], $expiresAt)->plainTextToken;
        $user->load('roles.permissions', 'restaurant.plan', 'restaurant.subscription', 'agent');
        $this->sendRestaurantAccountCreatedMailOnce($user);

        return response()->json([
            'message' => 'Connexion reussie',
            'token' => $token,
            'token_expires_at' => $expiresAt->toIso8601String(),
            'user' => $user,
            'restaurant' => $user->restaurant,
        ]);
    }

    public function adminLogin(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::with('roles')->where('email', $request->email)->first();

        if (!$user || $user->restaurant_id || !$user->hasRole('admin') || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Identifiants administrateur incorrects.'], 401);
        }

        $otpCode = rand(10000, 99999);
        Otp::where('user_id', $user->id)->delete();
        Otp::create([
            'user_id' => $user->id,
            'code' => $otpCode,
            'expires_at' => Carbon::now()->addMinutes(5),
        ]);

        Mail::to($user->email)->send(new SendOtpMail($otpCode));

        return response()->json([
            'message' => 'Un code OTP a été envoyé à votre adresse e-mail.',
        ]);
    }

    public function adminVerifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|digits:5',
        ]);

        $user = User::with('roles')->where('email', $request->email)->first();

        if (!$user || $user->restaurant_id || !$user->hasRole('admin')) {
            return response()->json(['message' => 'Administrateur introuvable.'], 404);
        }

        $otp = Otp::where('user_id', $user->id)
            ->where('code', $request->otp)
            ->where('expires_at', '>=', Carbon::now())
            ->first();

        if (!$otp) {
            return response()->json(['message' => 'OTP invalide ou expire.'], 400);
        }

        $otp->delete();
        $expiresAt = $this->tokenExpiresAt();
        $token = $user->createToken('Admin API Token', ['*'], $expiresAt)->plainTextToken;

        return response()->json([
            'message' => 'Connexion administrateur reussie.',
            'token' => $token,
            'token_expires_at' => $expiresAt->toIso8601String(),
            'user' => $user,
        ]);
    }

    public function register(Request $request)
    {
        $restaurant = $request->user()?->restaurant()->with('plan')->first();

        if ($restaurant && $restaurant->plan) {
            $limit = $restaurant->plan->maxUsers();
            if ($limit !== null && $limit > 0 && $restaurant->users()->count() >= $limit) {
                return response()->json([
                    'message' => "Limite d'utilisateurs atteinte pour le plan {$restaurant->plan->name}.",
                ], 422);
            }
        }

        $validated = $request->validate([
            'agent_id' => 'required|uuid|exists:agents,id',
            'role' => 'nullable|string',
            'role_id' => 'nullable|integer',
            'roles' => 'nullable|array',
            'roles.*' => 'nullable',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'integer',
        ]);

        $agent = Agent::query()
            ->when($request->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->findOrFail($validated['agent_id']);

        if ($agent->user_id || User::where('agent_id', $agent->id)->exists() || User::where('email', $agent->email)->exists()) {
            return response()->json([
                'message' => 'Cet employe possede deja un compte utilisateur.',
            ], 422);
        }

        $plainPassword = $this->temporaryPassword();

        $user = User::create([
            'first_name' => $agent->first_name,
            'last_name' => $agent->last_name,
            'email' => $agent->email,
            'phone_number' => $agent->phone_number,
            'address' => $agent->address,
            'restaurant_id' => $request->user()?->restaurant_id,
            'agent_id' => $agent->id,
            'password' => Hash::make($plainPassword),
            'is_first_login' => true,
        ]);

        $roles = $this->rolesForRequest($request, $validated);
        if ($roles->isNotEmpty()) {
            $user->syncRoles($roles);
        }

        $agent->update(['user_id' => $user->id]);
        Mail::to($user->email)->send(new AccountCreatedMail($user, $plainPassword));

        return response()->json([
            'message' => 'Utilisateur cree avec succes. Un email de connexion a ete envoye.',
            'data' => $user->load('roles.permissions', 'agent'),
        ], 201);
    }

    private function temporaryPassword(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $groups = [];

        for ($group = 0; $group < 3; $group++) {
            $part = '';
            for ($index = 0; $index < 4; $index++) {
                $part .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $groups[] = $part;
        }

        return 'RS-' . implode('-', $groups);
    }

    public function index()
    {
        $users = User::with('roles.permissions', 'agent')
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->paginate(10);

        return response()->json($users);
    }

    public function requestOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = User::where('email', $request->email)->firstOrFail();
        $otpCode = rand(10000, 99999);

        Otp::where('user_id', $user->id)->delete();
        Otp::create([
            'user_id' => $user->id,
            'code' => $otpCode,
            'expires_at' => Carbon::now()->addMinutes(5),
        ]);

        $mailSent = true;
        try {
            Mail::to($user->email)->send(new SendOtpMail($otpCode));
        } catch (\Throwable) {
            $mailSent = false;
        }

        return response()->json([
            'message' => $mailSent
                ? 'Un nouveau code OTP a ete envoye a votre adresse email.'
                : 'Le code OTP a ete regenere, mais l email n a pas pu etre envoye en local.',
            'dev_otp' => app()->environment('local') && !$mailSent ? $otpCode : null,
        ]);
    }

    private function sendRestaurantAccountCreatedMailOnce(User $user): void
    {
        $restaurant = $user->restaurant;

        if (!$restaurant) {
            return;
        }

        $settings = $restaurant->settings ?? [];

        if (($settings['account_created_mail_sent'] ?? true) !== false) {
            return;
        }

        try {
            Mail::to($user->email)->send(new RestaurantAccountCreatedMail(
                $user,
                $restaurant->fresh(['plan', 'subscription'])
            ));

            $restaurant->update([
                'settings' => [
                    ...$settings,
                    'account_created_mail_sent' => true,
                ],
            ]);
        } catch (\Throwable) {
        }
    }

    public function show($id)
    {
        $user = User::with('roles.permissions', 'agent')
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->findOrFail($id);

        return response()->json($user);
    }

    public function update(Request $request, $id)
    {
        $user = User::query()
            ->when($request->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->findOrFail($id);

        $validated = $request->validate([
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone_number' => 'sometimes|nullable|string|max:20',
            'address' => 'sometimes|nullable|string|max:255',
            'password' => 'sometimes|nullable|string|min:6',
            'is_first_login' => 'sometimes|boolean',
            'role' => 'sometimes|nullable|string',
            'role_id' => 'sometimes|nullable|integer',
            'roles' => 'sometimes|array',
            'roles.*' => 'nullable',
            'role_ids' => 'sometimes|array',
            'role_ids.*' => 'integer',
        ]);

        if ($this->requestChangesRoles($request) && $user->id === $request->user()?->id && !$this->isRestaurantOwner($request->user())) {
            return response()->json([
                'message' => 'Vous ne pouvez pas modifier vos propres permissions. Demandez au proprietaire du restaurant de le faire.',
            ], 403);
        }

        $data = collect($validated)
            ->except(['password', 'role', 'role_id', 'roles', 'role_ids'])
            ->toArray();

        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        if ($this->requestChangesRoles($request)) {
            $user->syncRoles($this->rolesForRequest($request, $validated));
        }

        return response()->json([
            'message' => 'Utilisateur mis a jour avec succes',
            'data' => $user->load('roles.permissions', 'agent'),
        ]);
    }

    public function destroy($id)
    {
        $user = User::query()
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->findOrFail($id);

        if ($user->agent_id) {
            Agent::where('id', $user->agent_id)->update(['user_id' => null]);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'message' => 'Utilisateur supprime avec succes',
        ]);
    }

    private function rolesForRequest(Request $request, array $validated)
    {
        $roleIds = collect($validated['role_ids'] ?? [])
            ->push($validated['role_id'] ?? null)
            ->merge($validated['roles'] ?? [])
            ->filter(fn ($value) => is_numeric($value))
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values();

        $roleNames = collect($validated['roles'] ?? [])
            ->push($validated['role'] ?? null)
            ->filter(fn ($value) => is_string($value) && $value !== '' && !is_numeric($value))
            ->unique()
            ->values();

        $requestedCount = $roleIds->count() + $roleNames->count();
        if ($requestedCount === 0) {
            return collect();
        }

        $query = Role::query()
            ->when(
                $request->user()?->restaurant_id,
                fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId),
                fn ($builder) => $builder->whereNull('restaurant_id')
            );

        $roles = $query
            ->where(function ($builder) use ($roleIds, $roleNames) {
                if ($roleIds->isNotEmpty()) {
                    $builder->whereIn('id', $roleIds);
                }

                if ($roleNames->isNotEmpty()) {
                    $method = $roleIds->isNotEmpty() ? 'orWhereIn' : 'whereIn';
                    $builder->{$method}('name', $roleNames);
                }
            })
            ->get();

        abort_if($roles->count() !== $requestedCount, 422, 'Un ou plusieurs roles ne sont pas disponibles pour ce restaurant.');

        return $roles;
    }

    private function requestChangesRoles(Request $request): bool
    {
        return $request->has('roles')
            || $request->has('role')
            || $request->has('role_ids')
            || $request->has('role_id');
    }

    private function isRestaurantOwner(?User $user): bool
    {
        $restaurant = $user?->restaurant;
        if (!$user || !$restaurant) {
            return false;
        }

        if ($restaurant->business_owner_user_id) {
            return $restaurant->business_owner_user_id === $user->id;
        }

        return strcasecmp((string) $restaurant->owner_email, (string) $user->email) === 0;
    }

    public function search(Request $request)
    {
        $query = $request->input('query');

        if (!$query) {
            return response()->json([
                'message' => 'Veuillez fournir un terme de recherche.',
            ], 400);
        }

        $users = User::with('roles.permissions', 'agent')
            ->when($request->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId))
            ->where(function ($builder) use ($query) {
                $builder->where('first_name', 'LIKE', "%{$query}%")
                    ->orWhere('last_name', 'LIKE', "%{$query}%")
                    ->orWhere('email', 'LIKE', "%{$query}%")
                    ->orWhere('phone_number', 'LIKE', "%{$query}%");
            })
            ->paginate(10);

        return response()->json($users);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Deconnexion reussie',
        ]);
    }

    public function changePassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required',
            'new_password' => 'required|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation echouee',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'message' => 'Mot de passe actuel incorrect',
            ], 400);
        }

        $user->password = Hash::make($request->new_password);
        $user->is_first_login = false;
        $user->save();

        return response()->json([
            'message' => 'Mot de passe changé avec succès',
            'is_first_login' => $user->is_first_login,
        ]);
    }

    private function tokenExpiresAt(): Carbon
    {
        return Carbon::now()->addMinutes((int) env('AUTH_TOKEN_TTL_MINUTES', 1440));
    }
}
