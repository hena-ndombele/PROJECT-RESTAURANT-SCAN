<?php

namespace App\Http\Controllers\tables;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Table;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use Illuminate\Support\Facades\Storage;

class TableController extends Controller
{



public function store(Request $request)
{
    // 1. Validation rigoureuse
    $request->validate([
        'name' => 'required|string|max:100|unique:tables,name',
        'capacity' => 'required|integer|min:1',
        'server_phone' => 'nullable|string|max:20',
    ]);

    // 2. Création de la table avec les nouveaux champs
    $table = Table::create([
        'name' => $request->name,
        'capacity' => $request->capacity,
        'status' => 'Libre', // Statut par défaut
        'server_phone' => $request->server_phone,
    ]);

    // 3. Préparer l'URL du menu
    $frontendUrl = "http://172.20.10.3:5173"; // Port par défaut de Vite/React
$url = "{$frontendUrl}/menu?table_id={$table->id}";
    // $url = url("/menu?table_id={$table->id}");

    // 4. Génération du QR (Syntaxe identique à votre version fonctionnelle)
    $qrImage = QrCode::format('svg')
        ->size(400)
        ->errorCorrection('H')
        ->margin(2)
        ->merge(public_path('assets/logo1.png'), .25, true)
        ->generate($url);

    // 5. Stockage (Utilisation de votre ancienne méthode de vérification de dossier)
    $qrPath = "qrcodes/table_{$table->id}.svg";
    if (!Storage::disk('public')->exists('qrcodes')) {
        Storage::disk('public')->makeDirectory('qrcodes');
    }
    Storage::disk('public')->put($qrPath, $qrImage);

    // 6. Mise à jour du chemin dans la DB
    $table->qr_code = $qrPath;
    $table->save();

    return response()->json([
        'message' => 'Table créée avec succès',
        'table' => $table,
        'qr_url' => asset("storage/{$qrPath}")
    ]);
}



    // Lister toutes les tables avec QR
   public function index()
{
    $tables = Table::all()->map(function($table) {
        return [
            'id' => $table->id,
            'name' => $table->name,
            'capacity' => $table->capacity,
            'status' => $table->status,
            'status_color' => match($table->status) {
                'Libre' => 'green',
                'Occupée' => 'yellow',
                'Réservée' => 'blue',
                default => 'gray'
            },
            'qr_url' => $table->qr_code ? asset("storage/{$table->qr_code}") : null,
            'created_at' => $table->created_at ? $table->created_at->toIso8601ZuluString() : null,
            'updated_at' => $table->updated_at ? $table->updated_at->toIso8601ZuluString() : null,
        ];
    });

    return response()->json($tables);
}

    public function show($id)
    {
        $table = Table::findOrFail($id);
        return response()->json($table);
    }

    public function update(Request $request, $id)
    {
        $table = Table::findOrFail($id);
        $table->update($request->only(['name', 'server_phone']));
        return response()->json([
            'message' => 'Table mise à jour',
            'table' => $table
        ]);
    }

    public function destroy($id)
    {
        $table = Table::findOrFail($id);
        $table->delete();
        return response()->json(['message' => 'Table supprimée']);
    }
}







