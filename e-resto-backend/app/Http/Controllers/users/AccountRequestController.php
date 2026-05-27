<?php

namespace App\Http\Controllers\Users; // Convention : Majuscule pour le dossier

use App\Http\Controllers\Controller;
use App\Models\AccountRequest; // Importation propre
use Illuminate\Http\Request;

class AccountRequestController extends Controller
{
    public function store(Request $request)
    {
        // 1. Validation
        $validatedData = $request->validate([
            'username' => 'required|string|max:255',
            'phone'    => 'required|string|max:20',
            'message'  => 'nullable|string',
        ]);

        // 2. Création (On utilise les données validées)
        $accountRequest = AccountRequest::create([
            'username' => $validatedData['username'],
            'phone'    => $validatedData['phone'],
            'message'  => $validatedData['message'],
            'status'   => 'pending', 
        ]);

        // 3. Réponse JSON
        return response()->json([
            'message' => 'Demande de compte soumise avec succès', 
            'data'    => $accountRequest
        ], 201);
    }



   public function index()
    {
        $accountRequest = AccountRequest::all();
        return response()->json($accountRequest);
    }

    public function destroy($id)
    {
        $accountRequest = AccountRequest::findOrFail($id);
        $accountRequest->delete();

        return response()->json([
            'message' => 'Demande de compte supprimee avec succes',
        ]);
    }
}
