<?php

namespace App\Http\Controllers\order;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Table;
use App\Models\Plat;
use App\Events\OrderPlaced;
use App\Events\OrderStatusUpdated;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class OrderController extends Controller
{
    /**
     * Création d'une commande et occupation de la table
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'table_id' => 'required|uuid|exists:tables,id',
            'note' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.plat_id' => 'required|uuid|exists:plats,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        try {
            return DB::transaction(function () use ($validated, $request) {
                $order = Order::create([
                    'table_id' => $validated['table_id'],
                    'note' => $validated['note'] ?? null,
                    'status' => 'pending',
                ]);

                $total = 0;
                $mainCurrency = 'CDF';

                foreach ($request->items as $item) {
                    $plat = Plat::findOrFail($item['plat_id']);

                    if (!$plat->is_available) {
                        throw new \Exception("Le plat {$plat->name} n'est plus disponible");
                    }

                    $order->items()->create([
                        'plat_id' => $plat->id,
                        'quantity' => $item['quantity'],
                        'price_at_order' => $plat->price,
                    ]);

                    $total += ($plat->price * $item['quantity']);
                    $mainCurrency = $plat->currency;
                }

                $order->update([
                    'total_amount' => $total,
                    'currency' => $mainCurrency
                ]);

                // LA TABLE DEVIENT OCCUPÉE
                $table = Table::findOrFail($validated['table_id']);
                $table->update(['status' => 'Occupée']);

                broadcast(new OrderPlaced($order->load(['table', 'items.plat'])))->toOthers();

                return response()->json([
                    'message' => 'Commande réussie',
                    'order' => $order->load('items.plat')
                ], 201);
            });
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Erreur lors de la commande',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mise à jour du statut et LIBÉRATION de la table
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:pending,preparing,ready,delivered,paid,cancelled'
        ]);

        try {
            return DB::transaction(function () use ($request, $id) {
                $order = Order::findOrFail($id);
                $order->update(['status' => $request->status]);

                // LOGIQUE DE LIBÉRATION
                // La table redevient libre si la commande est payée ou annulée
                if (in_array($request->status, ['paid', 'cancelled'])) {
                    $table = Table::find($order->table_id);
                    if ($table) {
                        $table->update(['status' => 'Libre']);
                    }
                }

                broadcast(new OrderStatusUpdated($order))->toOthers();

                return response()->json([
                    'message' => 'Statut mis à jour avec succès',
                    'order' => $order->load(['table', 'items.plat'])
                ]);
            });
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function index(Request $request)
    {
        $query = Order::with(['table', 'items.plat']);

        if ($request->has('day')) {
            $query->whereDate('created_at', $request->day);
        }

        if ($request->has('month')) {
            $query->whereMonth('created_at', $request->month)
                  ->whereYear('created_at', $request->get('year', date('Y')));
        }

        if (!$request->hasAny(['day', 'month', 'year'])) {
            $query->whereDate('created_at', Carbon::today());
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function show($id)
    {
        $order = Order::with(['table', 'items.plat'])->findOrFail($id);

        return response()->json($order);
    }

    public function destroyAll()
    {
        DB::transaction(function () {
            Order::query()->delete();
            Table::query()->update(['status' => 'Libre']);
        });

        return response()->json(['message' => 'Historique vidé et tables libérées']);
    }

    /**
 * Supprimer une commande spécifique
 */
public function destroy($id)
{
    try {
        return DB::transaction(function () use ($id) {
            $order = Order::findOrFail($id);
            $tableId = $order->table_id;

            // 1. Supprimer la commande 
            // (Les items seront supprimés si 'onDelete cascade' est configuré)
            $order->delete();

            // 2. Vérifier s'il reste d'autres commandes actives pour cette table
            // Si c'est la seule commande, on libère la table
            $otherOrders = Order::where('table_id', $tableId)
                ->whereNotIn('status', ['paid', 'cancelled'])
                ->exists();

            if (!$otherOrders) {
                Table::where('id', $tableId)->update(['status' => 'Libre']);
            }

            return response()->json([
                'message' => 'Commande supprimée avec succès et table mise à jour'
            ], 200);
        });
    } catch (\Exception $e) {
        return response()->json([
            'error' => 'Erreur lors de la suppression',
            'details' => $e->getMessage()
        ], 500);
    }
}
}
