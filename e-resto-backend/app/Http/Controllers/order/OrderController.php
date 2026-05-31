<?php

namespace App\Http\Controllers\order;

use App\Events\OrderPlaced;
use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plat;
use App\Models\Table;
use App\Services\MaishaPayService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function __construct(private MaishaPayService $maishaPayService)
    {
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'table_id' => 'required|uuid|exists:tables,id',
            'order_type' => 'nullable|string|in:dine_in,takeaway',
            'note' => 'nullable|string',
            'payment_method' => 'nullable|string|in:cash,mobile_money,orange_money,mpesa,airtel_money',
            'payment_provider' => 'nullable|string',
            'wallet_id' => 'nullable|string|required_unless:payment_method,cash',
            'customer_name' => 'nullable|string|max:120',
            'customer_phone' => 'nullable|string|max:30',
            'customer_email' => 'nullable|email|max:160',
            'items' => 'required|array|min:1',
            'items.*.plat_id' => 'required|uuid|exists:plats,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        try {
            return DB::transaction(function () use ($validated, $request) {
                $table = Table::with('restaurant')->findOrFail($validated['table_id']);

                if (!$table->restaurant || !in_array($table->restaurant->status, ['active', 'trial'], true)) {
                    throw new \Exception("Ce restaurant n'accepte pas de commandes pour le moment.");
                }

                $requestedMethod = $validated['payment_method'] ?? 'cash';
                $orderType = $validated['order_type'] ?? 'dine_in';
                $isMobileMoney = $requestedMethod !== 'cash';
                $paymentProvider = $isMobileMoney ? ($validated['payment_provider'] ?? $requestedMethod) : null;

                $order = Order::create([
                    'tracking_code' => $this->generateTrackingCode(),
                    'table_id' => $table->id,
                    'restaurant_id' => $table->restaurant_id,
                    'order_type' => $orderType,
                    'note' => $validated['note'] ?? null,
                    'customer_name' => $validated['customer_name'] ?? null,
                    'customer_phone' => $validated['customer_phone'] ?? ($validated['wallet_id'] ?? null),
                    'customer_email' => $validated['customer_email'] ?? null,
                    'pickup_name' => $orderType === 'takeaway' ? ($validated['customer_name'] ?? null) : null,
                    'pickup_phone' => $orderType === 'takeaway' ? ($validated['customer_phone'] ?? ($validated['wallet_id'] ?? null)) : null,
                    'status' => 'pending',
                    'payment_method' => $isMobileMoney ? 'mobile_money' : 'cash',
                    'payment_provider' => $paymentProvider,
                    'payment_status' => $isMobileMoney ? 'pending' : 'unpaid',
                ]);

                $total = 0;
                $mainCurrency = $table->restaurant->currency ?? 'CDF';

                foreach ($validated['items'] as $item) {
                    $plat = Plat::query()
                        ->where('restaurant_id', $table->restaurant_id)
                        ->findOrFail($item['plat_id']);

                    if (!$plat->is_available) {
                        throw new \Exception("Le plat {$plat->name} n'est plus disponible.");
                    }

                    $order->items()->create([
                        'plat_id' => $plat->id,
                        'quantity' => $item['quantity'],
                        'price_at_order' => $plat->price,
                    ]);

                    $total += ((float) $plat->price * (int) $item['quantity']);
                    $mainCurrency = $plat->currency;
                }

                $order->update([
                    'total_amount' => $total,
                    'currency' => $mainCurrency,
                ]);

                $payment = Payment::create([
                    'restaurant_id' => $table->restaurant_id,
                    'order_id' => $order->id,
                    'type' => 'order',
                    'method' => $order->payment_method,
                    'provider' => $order->payment_provider,
                    'status' => $isMobileMoney ? 'pending' : 'unpaid',
                    'amount' => $total,
                    'currency' => $mainCurrency,
                    'reference' => 'ORD-' . Str::upper(substr($order->id, 0, 8)),
                    'metadata' => [
                        'message' => $isMobileMoney
                            ? 'Paiement mobile money en attente de confirmation.'
                            : 'Paiement cash a confirmer par le restaurant.',
                    ],
                ]);

                $paymentResponse = null;
                if ($isMobileMoney) {
                    $paymentResponse = $this->maishaPayService->collectMobileMoney(
                        $payment,
                        [
                            'name' => $validated['customer_name'] ?? 'Client ' . $table->name,
                            'email' => $validated['customer_email'] ?? 'client@e-resto.local',
                        ],
                        $paymentProvider,
                        $validated['wallet_id'],
                        url('/api/orders/payment-callback')
                    );

                    $paymentStatus = $this->mapGatewayPaymentStatus($paymentResponse['transactionStatus'] ?? null);
                    $payment->update([
                        'status' => $paymentStatus,
                        'metadata' => array_merge($payment->metadata ?? [], [
                            'wallet_id' => $validated['wallet_id'],
                            'gateway_response' => $paymentResponse,
                        ]),
                        'paid_at' => $paymentStatus === 'paid' ? now() : null,
                    ]);
                    $order->update(['payment_status' => $paymentStatus]);
                }

                $table->update(['status' => 'Occupee']);

                broadcast(new OrderPlaced($order->load(['table', 'items.plat', 'latestPayment'])))->toOthers();

                return response()->json([
                    'message' => 'Commande reussie',
                    'order' => $order->load(['table', 'items.plat', 'latestPayment']),
                    'payment' => $payment->fresh(),
                    'payment_response' => $paymentResponse,
                ], 201);
            });
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Erreur lors de la commande',
                'details' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,preparing,ready,delivered,cancelled',
            'cancellation_reason' => 'required_if:status,cancelled|nullable|string|min:3|max:500',
        ]);

        try {
            return DB::transaction(function () use ($request, $id, $validated) {
                $order = Order::query()
                    ->when($request->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId))
                    ->findOrFail($id);

                if ($validated['status'] === 'cancelled') {
                    if ($order->status === 'delivered') {
                        return response()->json([
                            'message' => "Une commande deja servie ne peut plus etre annulee.",
                        ], 422);
                    }

                    $this->cancelOrder(
                        $order,
                        $validated['cancellation_reason'],
                        $request->user()?->id,
                        'restaurant'
                    );
                } else {
                    if ($order->status === 'cancelled') {
                        throw new \Exception("Une commande annulee ne peut plus changer de statut.");
                    }

                    $transitionError = $this->statusTransitionError($order->status, $validated['status']);
                    if ($transitionError) {
                        return response()->json(['message' => $transitionError], 422);
                    }

                    $order->update(['status' => $validated['status']]);
                }

                $this->releaseTableIfComplete($order);

                broadcast(new OrderStatusUpdated($order))->toOthers();

                return response()->json([
                    'message' => 'Statut mis a jour avec succes',
                    'order' => $order->load(['table', 'items.plat', 'latestPayment']),
                ]);
            });
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function cancelFromClient(Request $request, $id)
    {
        $validated = $request->validate([
            'cancellation_reason' => 'required|string|min:3|max:500',
        ]);

        try {
            return DB::transaction(function () use ($id, $validated) {
                $order = Order::with(['table', 'items.plat', 'latestPayment'])->findOrFail($id);

                if ($order->status !== 'pending') {
                    return response()->json([
                        'message' => "La commande ne peut plus etre annulee par le client.",
                    ], 422);
                }

                if ($order->payment_status === 'paid') {
                    return response()->json([
                        'message' => "La commande est deja payee. Demandez l'annulation au restaurant.",
                    ], 422);
                }

                $this->cancelOrder($order, $validated['cancellation_reason'], null, 'client');
                $this->releaseTableIfComplete($order);
                broadcast(new OrderStatusUpdated($order))->toOthers();

                return response()->json([
                    'message' => 'Commande annulee',
                    'order' => $order->load(['table', 'items.plat', 'latestPayment']),
                ]);
            });
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function updateItemsFromClient(Request $request, $id)
    {
        $validated = $request->validate([
            'note' => 'nullable|string',
            'order_type' => 'nullable|string|in:dine_in,takeaway',
            'wallet_id' => 'nullable|string',
            'customer_name' => 'nullable|string|max:120',
            'customer_phone' => 'nullable|string|max:30',
            'customer_email' => 'nullable|email|max:160',
            'items' => 'required|array|min:1',
            'items.*.plat_id' => 'required|uuid|exists:plats,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        try {
            return DB::transaction(function () use ($id, $validated) {
                $order = Order::with(['table.restaurant', 'items.plat', 'latestPayment'])
                    ->whereKey($id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($order->status !== 'pending') {
                    return response()->json([
                        'message' => "La commande ne peut plus etre modifiee car la preparation a deja commence.",
                    ], 422);
                }

                if ($order->payment_status === 'paid') {
                    return response()->json([
                        'message' => "La commande est deja payee. Demandez une modification au restaurant.",
                    ], 422);
                }

                $total = 0;
                $mainCurrency = $order->currency;
                $itemsByPlat = collect($validated['items'])
                    ->groupBy('plat_id')
                    ->map(fn ($items) => [
                        'plat_id' => $items->first()['plat_id'],
                        'quantity' => $items->sum('quantity'),
                    ])
                    ->values();

                $order->items()->delete();

                foreach ($itemsByPlat as $item) {
                    $plat = Plat::query()
                        ->where('restaurant_id', $order->restaurant_id)
                        ->findOrFail($item['plat_id']);

                    if (!$plat->is_available) {
                        throw new \Exception("Le plat {$plat->name} n'est plus disponible.");
                    }

                    $order->items()->create([
                        'plat_id' => $plat->id,
                        'quantity' => $item['quantity'],
                        'price_at_order' => $plat->price,
                    ]);

                    $total += ((float) $plat->price * (int) $item['quantity']);
                    $mainCurrency = $plat->currency;
                }

                $nextOrderType = $validated['order_type'] ?? $order->order_type ?? 'dine_in';
                $nextCustomerName = $validated['customer_name'] ?? $order->customer_name;
                $nextCustomerPhone = $validated['customer_phone'] ?? $order->customer_phone;

                $order->update([
                    'note' => $validated['note'] ?? null,
                    'order_type' => $nextOrderType,
                    'pickup_name' => $nextOrderType === 'takeaway' ? $nextCustomerName : null,
                    'pickup_phone' => $nextOrderType === 'takeaway' ? $nextCustomerPhone : null,
                    'customer_name' => $nextCustomerName,
                    'customer_phone' => $nextCustomerPhone,
                    'customer_email' => $validated['customer_email'] ?? $order->customer_email,
                    'total_amount' => $total,
                    'currency' => $mainCurrency,
                ]);

                $paymentResponse = null;
                $payment = $order->latestPayment()->first();

                if ($payment) {
                    $metadata = $payment->metadata ?? [];
                    $metadata['modified_at'] = now()->toIso8601String();
                    $metadata['modification_message'] = 'Commande modifiee par le client avant preparation.';

                    if ($order->payment_method === 'mobile_money') {
                        $payment->update([
                            'status' => 'failed',
                            'metadata' => array_merge($metadata, [
                                'replacement_reason' => 'Montant modifie avant confirmation du paiement.',
                            ]),
                        ]);

                        $walletId = $validated['wallet_id'] ?? ($payment->metadata['wallet_id'] ?? null);
                        if (!$walletId) {
                            $order->update(['payment_status' => 'failed']);
                        } else {
                            $newPayment = Payment::create([
                                'restaurant_id' => $order->restaurant_id,
                                'order_id' => $order->id,
                                'type' => 'order',
                                'method' => 'mobile_money',
                                'provider' => $order->payment_provider,
                                'status' => 'pending',
                                'amount' => $total,
                                'currency' => $mainCurrency,
                                'reference' => 'ORD-' . Str::upper(substr($order->id, 0, 8)) . '-' . Str::upper(Str::random(4)),
                                'metadata' => [
                                    'wallet_id' => $walletId,
                                    'message' => 'Nouveau paiement apres modification de commande.',
                                ],
                            ]);

                            $paymentResponse = $this->maishaPayService->collectMobileMoney(
                                $newPayment,
                                [
                                    'name' => $validated['customer_name'] ?? 'Client ' . ($order->table?->name ?? ''),
                                    'email' => $validated['customer_email'] ?? 'client@e-resto.local',
                                ],
                                $order->payment_provider ?? 'MPESA',
                                $walletId,
                                url('/api/orders/payment-callback')
                            );

                            $paymentStatus = $this->mapGatewayPaymentStatus($paymentResponse['transactionStatus'] ?? null);
                            $newPayment->update([
                                'status' => $paymentStatus,
                                'metadata' => array_merge($newPayment->metadata ?? [], ['gateway_response' => $paymentResponse]),
                                'paid_at' => $paymentStatus === 'paid' ? now() : null,
                            ]);
                            $order->update(['payment_status' => $paymentStatus]);
                        }
                    } else {
                        $payment->update([
                            'amount' => $total,
                            'currency' => $mainCurrency,
                            'status' => 'unpaid',
                            'metadata' => $metadata,
                            'paid_at' => null,
                        ]);
                        $order->update(['payment_status' => 'unpaid']);
                    }
                }

                broadcast(new OrderStatusUpdated($order))->toOthers();

                return response()->json([
                    'message' => 'Commande modifiee avec succes',
                    'order' => $order->load(['table', 'items.plat', 'latestPayment']),
                    'payment_response' => $paymentResponse,
                ]);
            });
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Erreur lors de la modification',
                'details' => $e->getMessage(),
            ], 500);
        }
    }

    public function requestBillFromClient($id)
    {
        try {
            return DB::transaction(function () use ($id) {
                $order = Order::with(['table', 'items.plat', 'latestPayment'])->lockForUpdate()->findOrFail($id);

                if ($order->payment_method !== 'cash') {
                    return response()->json([
                        'message' => "La demande d'addition est reservee aux commandes payees en cash.",
                    ], 422);
                }

                if ($order->status !== 'delivered') {
                    return response()->json([
                        'message' => "L'addition peut etre demandee apres que la commande soit servie.",
                    ], 422);
                }

                if ($order->payment_status === 'paid') {
                    return response()->json([
                        'message' => "Cette commande est deja payee.",
                    ], 422);
                }

                $payment = $order->payments()->latest()->first();
                if (!$payment) {
                    $payment = Payment::create([
                        'restaurant_id' => $order->restaurant_id,
                        'order_id' => $order->id,
                        'type' => 'order',
                        'method' => 'cash',
                        'status' => $order->payment_status ?: 'unpaid',
                        'amount' => $order->total_amount,
                        'currency' => $order->currency,
                        'reference' => 'ORD-' . Str::upper(substr($order->id, 0, 8)),
                    ]);
                }

                $metadata = $payment->metadata ?? [];
                $metadata['bill_requested'] = true;
                $metadata['bill_requested_at'] = now()->toIso8601String();

                $payment->update(['metadata' => $metadata]);
                $freshOrder = $order->fresh(['table', 'items.plat', 'latestPayment']);
                broadcast(new OrderStatusUpdated($freshOrder))->toOthers();

                return response()->json([
                    'message' => 'Demande d addition envoyee au restaurant.',
                    'order' => $freshOrder,
                ]);
            });
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function updatePaymentStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'payment_status' => 'required|in:unpaid,pending,paid,failed,refunded',
            'method' => 'nullable|string|in:cash,mobile_money',
            'received_amount' => 'nullable|numeric|min:0',
            'note' => 'nullable|string|max:500',
        ]);

        try {
            return DB::transaction(function () use ($request, $id, $validated) {
                $order = Order::query()
                    ->when($request->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId))
                    ->findOrFail($id);

                $method = $validated['method'] ?? $order->payment_method ?? 'cash';
                $payment = $order->latestPayment()->first() ?? new Payment([
                    'restaurant_id' => $order->restaurant_id,
                    'order_id' => $order->id,
                    'type' => 'order',
                    'reference' => 'ORD-' . Str::upper(substr($order->id, 0, 8)),
                ]);

                $metadata = $payment->metadata ?? [];
                $metadata['cashier_id'] = $request->user()?->id;
                $metadata['received_amount'] = $validated['received_amount'] ?? null;
                $metadata['change_amount'] = isset($validated['received_amount'])
                    ? max(0, (float) $validated['received_amount'] - (float) $order->total_amount)
                    : null;
                $metadata['note'] = $validated['note'] ?? null;

                $payment->fill([
                    'method' => $method,
                    'provider' => $method === 'cash' ? null : $order->payment_provider,
                    'status' => $validated['payment_status'],
                    'amount' => $order->total_amount,
                    'currency' => $order->currency,
                    'metadata' => $metadata,
                    'paid_at' => $validated['payment_status'] === 'paid' ? now() : null,
                ])->save();

                $order->update([
                    'payment_method' => $method,
                    'payment_status' => $validated['payment_status'],
                ]);

                $this->releaseTableIfComplete($order);
                broadcast(new OrderStatusUpdated($order))->toOthers();

                return response()->json([
                    'message' => 'Paiement mis a jour avec succes',
                    'order' => $order->load(['table', 'items.plat', 'latestPayment']),
                    'payment' => $payment->fresh(),
                ]);
            });
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function paymentCallback(Request $request)
    {
        $reference = $request->input('originatingTransactionId')
            ?? $request->input('transactionReference')
            ?? $request->input('reference');

        if (!$reference) {
            return response()->json(['message' => 'Reference paiement manquante'], 422);
        }

        $payment = Payment::where('reference', $reference)->firstOrFail();
        $status = $this->mapGatewayPaymentStatus($request->input('transactionStatus'));

        $payment->update([
            'status' => $status,
            'metadata' => array_merge($payment->metadata ?? [], ['callback' => $request->all()]),
            'paid_at' => $status === 'paid' ? now() : $payment->paid_at,
        ]);

        if ($payment->order) {
            $payment->order->update(['payment_status' => $status]);
            $this->releaseTableIfComplete($payment->order);
            broadcast(new OrderStatusUpdated($payment->order))->toOthers();
        }

        return response()->json(['message' => 'Callback paiement commande traite']);
    }

    public function index(Request $request)
    {
        $query = Order::with(['table', 'items.plat', 'latestPayment'])
            ->when($request->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId));

        if ($request->has('day')) {
            $query->whereDate('created_at', $request->day);
        }

        if ($request->has('month')) {
            $query->whereMonth('created_at', $request->month)
                ->whereYear('created_at', $request->get('year', date('Y')));
        }

        if ($request->has('year') && !$request->has('month')) {
            $query->whereYear('created_at', $request->year);
        }

        if (!$request->hasAny(['day', 'month', 'year'])) {
            $query->whereDate('created_at', Carbon::today());
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function show($id)
    {
        $order = Order::with(['table', 'items.plat', 'latestPayment'])
            ->when(request()->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId))
            ->findOrFail($id);

        return response()->json($order);
    }

    public function track(Request $request)
    {
        $validated = $request->validate([
            'code' => 'nullable|string|max:20',
            'order_id' => 'nullable|uuid',
            'table_id' => 'nullable|uuid',
            'phone' => 'nullable|string|max:30',
        ]);

        if (empty($validated['code']) && empty($validated['phone']) && empty($validated['table_id'])) {
            return response()->json([
                'message' => 'Entrez le code de suivi, le numero de telephone ou scannez une table avec commande active.',
            ], 422);
        }

        $query = Order::with(['table', 'items.plat', 'latestPayment']);

        if (!empty($validated['order_id'])) {
            $query->whereKey($validated['order_id']);
        }

        if (!empty($validated['code'])) {
            $query->where('tracking_code', Str::upper($validated['code']));
        }

        if (!empty($validated['phone'])) {
            $phone = preg_replace('/\s+/', '', $validated['phone']);
            $query->whereRaw("REPLACE(customer_phone, ' ', '') = ?", [$phone]);
        }

        if (!empty($validated['table_id'])) {
            $query->where('table_id', $validated['table_id']);
        }

        $isTableOnlyRecovery = !empty($validated['table_id'])
            && empty($validated['code'])
            && empty($validated['phone'])
            && empty($validated['order_id']);

        if ($isTableOnlyRecovery) {
            return response()->json([
                'message' => 'Pour proteger les clients, le QR de table seul ne restaure pas une commande existante. Entrez le code de suivi ou le numero de telephone pour retrouver votre commande.',
                'requires_tracking_code' => true,
            ], 409);
        }

        $order = $query
            ->whereNotIn('status', ['cancelled', 'delivered'])
            ->latest()
            ->first();

        if (!$order) {
            return response()->json([
                'message' => 'Aucune commande active trouvee avec ces informations.',
            ], 404);
        }

        return response()->json($order);
    }

    public function destroyAll()
    {
        DB::transaction(function () {
            $restaurantId = request()->user()?->restaurant_id;
            Order::query()
                ->when($restaurantId, fn ($builder) => $builder->where('restaurant_id', $restaurantId))
                ->delete();
            Table::query()
                ->when($restaurantId, fn ($builder) => $builder->where('restaurant_id', $restaurantId))
                ->update(['status' => 'Libre']);
        });

        return response()->json(['message' => 'Historique vide et tables liberees']);
    }

    public function destroy($id)
    {
        try {
            return DB::transaction(function () use ($id) {
                $order = Order::query()
                    ->when(request()->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId))
                    ->findOrFail($id);
                $tableId = $order->table_id;

                $order->delete();

                $otherOrders = Order::where('table_id', $tableId)
                    ->where('status', '!=', 'cancelled')
                    ->where(function ($query) {
                        $query->where('status', '!=', 'delivered')
                            ->orWhere('payment_status', '!=', 'paid');
                    })
                    ->exists();

                if (!$otherOrders) {
                    Table::where('id', $tableId)->update(['status' => 'Libre']);
                }

                return response()->json([
                    'message' => 'Commande supprimee avec succes et table mise a jour',
                ]);
            });
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Erreur lors de la suppression',
                'details' => $e->getMessage(),
            ], 500);
        }
    }

    private function mapGatewayPaymentStatus(?string $status): string
    {
        return match (Str::upper((string) $status)) {
            'SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED' => 'paid',
            'FAILED', 'CANCELLED', 'CANCELED', 'ERROR' => 'failed',
            default => 'pending',
        };
    }

    private function generateTrackingCode(): string
    {
        do {
            $code = Str::upper(Str::random(6));
        } while (Order::where('tracking_code', $code)->exists());

        return $code;
    }

    private function statusTransitionError(string $currentStatus, string $nextStatus): ?string
    {
        $order = [
            'pending' => 0,
            'preparing' => 1,
            'ready' => 2,
            'delivered' => 3,
        ];

        if ($currentStatus === 'delivered' && $nextStatus !== 'delivered') {
            return "Une commande servie ne peut plus revenir a un statut precedent.";
        }

        if (!isset($order[$currentStatus], $order[$nextStatus])) {
            return null;
        }

        if ($order[$nextStatus] < $order[$currentStatus]) {
            return "Impossible de revenir en arriere dans le statut de la commande.";
        }

        return null;
    }

    private function releaseTableIfComplete(Order $order): void
    {
        $order->refresh();

        if ($order->status === 'cancelled' || ($order->status === 'delivered' && $order->payment_status === 'paid')) {
            Table::where('id', $order->table_id)->update(['status' => 'Libre']);
        }
    }

    private function cancelOrder(Order $order, string $reason, ?string $cancelledBy, string $source): void
    {
        if ($order->status === 'cancelled') {
            throw new \Exception('Cette commande est deja annulee.');
        }

        if ($order->status === 'delivered') {
            throw new \Exception("Une commande deja servie ne peut plus etre annulee. Utilisez plutot un remboursement.");
        }

        $paymentStatus = $order->payment_status;
        $payment = $order->latestPayment()->first();

        if ($payment) {
            $metadata = $payment->metadata ?? [];
            $metadata['cancellation_reason'] = $reason;
            $metadata['cancelled_by'] = $cancelledBy;
            $metadata['cancelled_source'] = $source;
            $metadata['cancelled_at'] = now()->toIso8601String();

            $paymentStatus = match ($order->payment_status) {
                'paid' => 'refunded',
                'pending' => 'failed',
                default => $order->payment_status,
            };

            $payment->update([
                'status' => $paymentStatus,
                'metadata' => $metadata,
            ]);
        }

        $order->update([
            'status' => 'cancelled',
            'payment_status' => $paymentStatus,
            'cancellation_reason' => $reason,
            'cancelled_by' => $cancelledBy,
            'cancelled_at' => now(),
        ]);
    }
}
