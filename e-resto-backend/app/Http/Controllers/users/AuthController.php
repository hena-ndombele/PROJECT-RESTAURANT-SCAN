<?php

namespace App\Http\Controllers\users;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Mail\SendOtpMail;
use App\Models\User;
use App\Models\Otp;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;
use App\Mail\AccountCreatedMail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{

    /**
     * @OA\Post(
     *     path="/api/auth/login",
     *     summary="Connexion utilisateur",
     *     tags={"Auth"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"email","password"},
     *             @OA\Property(property="email", type="string", example="user@email.com"),
     *             @OA\Property(property="password", type="string", example="password123")
     *         )
     *     ),
     *     @OA\Response(response=200, description="OTP envoyé"),
     *     @OA\Response(response=401, description="Identifiants incorrects")
     * )
     */
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !$user->restaurant_id || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Identifiants incorrects'], 401);
        }

        $otpCode = rand(10000, 99999);

        Otp::where('user_id', $user->id)->delete();

        Otp::create([
            'user_id'   => $user->id,
            'code'      => $otpCode,
            'expires_at'=> Carbon::now()->addMinutes(5),
        ]);

        Mail::to($user->email)->send(new SendOtpMail($otpCode));

        return response()->json([
            'message' => 'Un code OTP a été envoyé à votre adresse email.'
        ]);
    }


    /**
     * @OA\Post(
     *     path="/api/auth/verify-otp",
     *     summary="Vérifier OTP",
     *     tags={"Auth"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"email","otp"},
     *             @OA\Property(property="email", type="string", example="user@email.com"),
     *             @OA\Property(property="otp", type="string", example="12345")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Connexion réussie")
     * )
     */
    public function verifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp'   => 'required|digits:5',
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
            return response()->json(['message' => 'OTP invalide ou expiré'], 400);
        }

        $otp->delete();

        $token = $user->createToken('API Token')->plainTextToken;

        return response()->json([
            'message' => 'Connexion réussie',
            'token'   => $token,
            'user'    => $user->load('roles'),
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
            'message' => 'Un code OTP a ete envoye a votre adresse email.',
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
        $token = $user->createToken('Admin API Token')->plainTextToken;

        return response()->json([
            'message' => 'Connexion administrateur reussie.',
            'token' => $token,
            'user' => $user,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/api/auth/register",
     *     summary="Créer un employé",
     *     tags={"Users"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"first_name","last_name","email","phone_number","role"},
     *             @OA\Property(property="first_name", type="string", example="Jean"),
     *             @OA\Property(property="last_name", type="string", example="Dupont"),
     *             @OA\Property(property="email", type="string", example="jean@email.com"),
     *             @OA\Property(property="phone_number", type="string", example="243900000000"),
     *             @OA\Property(property="address", type="string", example="Kinshasa"),
     *             @OA\Property(property="role", type="string", example="serveur")
     *         )
     *     ),
     *     @OA\Response(response=201, description="Utilisateur créé")
     * )
     */
    public function register(Request $request)
    {
        $restaurant = $request->user()?->restaurant()->with('plan')->first();

        if ($restaurant && $restaurant->plan) {
            $limit = (int) $restaurant->plan->max_users;
            if ($limit > 0 && $restaurant->users()->count() >= $limit) {
                return response()->json([
                    'message' => "Limite d'utilisateurs atteinte pour le plan {$restaurant->plan->name}.",
                ], 422);
            }
        }

        $validated = $request->validate([
            'first_name'   => 'required|string|max:100',
            'last_name'    => 'required|string|max:100',
            'email'        => 'required|string|email|unique:users',
            'phone_number' => 'required|string|max:20',
            'address'      => 'nullable|string|max:255',
            'password'     => 'nullable|string|min:6',
            'role'         => 'nullable|string|exists:roles,name',
            'roles'        => 'nullable|array',
            'roles.*'      => 'string|exists:roles,name',
        ]);

        $user = User::create([
            'first_name'   => $validated['first_name'],
            'last_name'    => $validated['last_name'],
            'email'        => $validated['email'],
            'phone_number' => $validated['phone_number'],
            'address'      => $validated['address'] ?? null,
            'restaurant_id' => $request->user()?->restaurant_id,
            'password'     => Hash::make($validated['password'] ?? '12345678'),
        ]);

        $roles = $validated['roles'] ?? [];
        if (!empty($validated['role'])) {
            $roles[] = $validated['role'];
        }

        if (!empty($roles)) {
            $user->syncRoles(array_values(array_unique($roles)));
        }

        Mail::to($user->email)->send(new AccountCreatedMail($user));

        return response()->json([
            'message' => 'Employé créé avec succès',
            'data'    => $user
        ], 201);
    }


    /**
     * @OA\Get(
     *     path="/api/users/list",
     *     summary="Lister utilisateurs",
     *     tags={"Users"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="Liste utilisateurs")
     * )
     */
    public function index()
    {
        $users = User::with('roles')
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

        Mail::to($user->email)->send(new SendOtpMail($otpCode));

        return response()->json([
            'message' => 'Un nouveau code OTP a ete envoye a votre adresse email.',
        ]);
    }

    public function show($id)
    {
        $user = User::with('roles')
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
            'role' => 'sometimes|nullable|string|exists:roles,name',
            'roles' => 'sometimes|array',
            'roles.*' => 'string|exists:roles,name',
        ]);

        $data = collect($validated)
            ->except(['password', 'role', 'roles'])
            ->toArray();

        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        if ($request->has('roles') || $request->has('role')) {
            $roles = $validated['roles'] ?? [];
            if (!empty($validated['role'])) {
                $roles[] = $validated['role'];
            }
            $user->syncRoles(array_values(array_unique($roles)));
        }

        return response()->json([
            'message' => 'Utilisateur mis a jour avec succes',
            'data' => $user->load('roles'),
        ]);
    }

    public function destroy($id)
    {
        $user = User::query()
            ->when(request()->user()?->restaurant_id, fn ($query, $restaurantId) => $query->where('restaurant_id', $restaurantId))
            ->findOrFail($id);
        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'message' => 'Utilisateur supprime avec succes',
        ]);
    }

    public function search(Request $request)
    {
        $query = $request->input('query');

        if (!$query) {
            return response()->json([
                'message' => 'Veuillez fournir un terme de recherche.',
            ], 400);
        }

        $users = User::with('roles')
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


    /**
     * @OA\Post(
     *     path="/api/logout",
     *     summary="Déconnexion",
     *     tags={"Auth"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="Déconnexion réussie")
     * )
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Déconnexion réussie'
        ]);
    }


    /**
     * @OA\Post(
     *     path="/api/auth/change-password",
     *     summary="Changer mot de passe",
     *     tags={"Auth"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"current_password","new_password","new_password_confirmation"},
     *             @OA\Property(property="current_password", type="string"),
     *             @OA\Property(property="new_password", type="string"),
     *             @OA\Property(property="new_password_confirmation", type="string")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Mot de passe changé")
     * )
     */
    public function changePassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required',
            'new_password' => 'required|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation échouée',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'message' => 'Mot de passe actuel incorrect'
            ], 400);
        }

        $user->password = Hash::make($request->new_password);
        $user->is_first_login = false;
        $user->save();

        return response()->json([
            'message' => 'Mot de passe changé avec succès',
            'is_first_login' => $user->is_first_login
        ]);
    }

}
