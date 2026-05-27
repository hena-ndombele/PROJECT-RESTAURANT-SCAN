<?php

namespace App\Http\Controllers\agents;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Agent;
use App\Notifications\WelcomeAgentNotification;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AgentController extends Controller
{
    public function store(Request $request)
    {
        // 1. Validation des données entrantes
        $request->validate([
            'first_name'      => 'required|string|max:255',
            'last_name'       => 'required|string|max:255',
            'email'           => 'required|email|unique:users,email',
            'phone_number'    => 'required|string',
            'address'         => 'required|string',
            'education_level' => 'required|string',
            'fonction'           => 'required|string',
        ]);

        try {
            // Utilisation d'une transaction pour garantir l'intégrité des données
            $user = DB::transaction(function () use ($request) {

                // Génération d'un mot de passe aléatoire unique
                $plainPassword = Str::random(10);

                // 2. Création de l'utilisateur (remplit 'users')
                // Note : On inclut first_name et last_name ici pour éviter l'erreur SQL 1364
                $user = User::create([
                    'name'       => $request->first_name . ' ' . $request->last_name,
                    'email'      => $request->email,
                    'password'   => Hash::make($plainPassword),
                    'first_name' => $request->first_name,
                    'last_name'  => $request->last_name,
                ]);

                // 3. Création de l'agent lié (remplit 'agents')
                Agent::create([
                    'user_id'         => $user->id,
                    'first_name'      => $request->first_name,
                    'last_name'       => $request->last_name,
                    'email'           => $request->email,
                    'phone_number'    => $request->phone_number,
                    'address'         => $request->address,
                    'education_level' => $request->education_level,
                    'fonction'           => $request->fonction,
                ]);

                // 4. Envoi de l'email de bienvenue avec le mot de passe clair
                 $user->notify(new WelcomeAgentNotification($plainPassword));

                return $user;
            });

            return response()->json([
                'status'  => 'success',
                'message' => 'Agent créé avec succès',
                'user'    => $user
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Erreur lors de la création de l\'agent.',
                'error'   => $e->getMessage()
            ], 500);
        }
    }


    public function index()
    {
        try {
            // On récupère tous les agents
            $agents = Agent::all();

            // On retourne une réponse JSON propre
            return response()->json([
                'success' => true,
                'data' => $agents
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des agents',
                'error' => $e->getMessage()
            ], 500);
        }
    }


    public function show($id)
    {
        $agent = Agent::find($id);

        if (!$agent) {
            return response()->json(['message' => 'Agent non trouvé'], 404);
        }

        return response()->json($agent, 200);
    }

    

    public function update(Request $request, $id)
    {
        $agent = Agent::find($id);

        if (!$agent) {
            return response()->json(['message' => 'Agent non trouvé'], 404);
        }

        $validated = $request->validate([
            'first_name' => 'sometimes|required',
            'last_name'  => 'sometimes|required',
            'email'      => 'sometimes|required|email',
            'phone_number' => 'sometimes|required',
        ]);

        $agent->update($request->all());

        return response()->json([
            'message' => 'Agent mis à jour avec succès',
            'data' => $agent
        ], 200);
    }

    public function destroy($id)
    {
        $agent = Agent::find($id);

        if (!$agent) {
            return response()->json(['message' => 'Agent non trouvé'], 404);
        }

        $agent->delete();

        return response()->json(['message' => 'Agent supprimé avec succès'], 200);
    }
}
