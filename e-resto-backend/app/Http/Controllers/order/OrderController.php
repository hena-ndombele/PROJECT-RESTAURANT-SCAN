<?php

namespace App\Http\Controllers\order;

use App\Events\OrderPlaced;
use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plat;
use App\Models\Restaurant;
use App\Models\Table;
use App\Models\TableSession;
use App\Models\User;
use App\Services\FirebasePushService;
use App\Services\MaishaPayService;
use App\Services\OrderEmailFollowupService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function __construct(
        private MaishaPayService $maishaPayService,
        private FirebasePushService $firebasePushService
    )
    {
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'table_id' => 'nullable|uuid|exists:tables,id',
            'restaurant_id' => 'nullable|uuid|exists:restaurants,id',
            'restaurant_slug' => 'nullable|string|exists:restaurants,slug',
            'table_session_token' => 'nullable|string|max:120',
            'order_type' => 'nullable|string|in:dine_in,takeaway,remote',
            'note' => 'nullable|string',
            'payment_method' => 'nullable|string|in:cash',
            'payment_provider' => 'nullable|string',
            'wallet_id' => 'nullable|string',
            'customer_name' => 'nullable|string|max:120',
            'customer_phone' => 'nullable|string|max:30',
            'customer_email' => 'nullable|email|max:160',
            'email_contact' => 'nullable|email|max:160',
            'email_receipt_opt_in' => 'nullable|boolean',
            'email_feedback_opt_in' => 'nullable|boolean',
            'items' => 'required|array|min:1',
            'items.*.plat_id' => 'required|uuid|exists:plats,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        try {
            return DB::transaction(function () use ($validated, $request) {
                $orderType = $validated['order_type'] ?? 'dine_in';
                $table = $this->resolveOrderTable($validated, $orderType);
                $tableSession = null;

                if ($orderType !== 'remote') {
                    $tableSession = $this->validTableSession($table, $validated['table_session_token'] ?? null);
                    if (!$tableSession) {
                        return response()->json([
                            'message' => 'Session de table expiree. Veuillez scanner a nouveau le QR code.',
                        ], 422);
                    }
                }

                if (!$table->restaurant || !in_array($table->restaurant->status, ['active', 'trial'], true)) {
                    throw new \Exception("Ce restaurant n'accepte pas de commandes pour le moment.");
                }

                $monthlyLimit = $table->restaurant->plan?->maxOrdersPerMonth();
                if ($monthlyLimit !== null) {
                    $ordersThisMonth = $table->restaurant->orders()
                        ->whereBetween('created_at', [Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth()])
                        ->count();
                    if ($ordersThisMonth >= $monthlyLimit) {
                        return response()->json([
                            'message' => "Limite de {$monthlyLimit} commandes mensuelles atteinte pour le plan {$table->restaurant->plan?->name}.",
                            'requires_upgrade' => true,
                        ], 403);
                    }
                }

                $order = Order::create([
                    'tracking_code' => $this->generateTrackingCode(),
                    'table_id' => $table->id,
                    'table_session_id' => $tableSession?->id,
                    'restaurant_id' => $table->restaurant_id,
                    'order_type' => $orderType,
                    'note' => $validated['note'] ?? null,
                    'customer_name' => $validated['customer_name'] ?? null,
                    'customer_phone' => $validated['customer_phone'] ?? ($validated['wallet_id'] ?? null),
                    'customer_email' => $validated['customer_email'] ?? ($validated['email_contact'] ?? null),
                    'pickup_name' => in_array($orderType, ['takeaway', 'remote'], true) ? ($validated['customer_name'] ?? null) : null,
                    'pickup_phone' => in_array($orderType, ['takeaway', 'remote'], true) ? ($validated['customer_phone'] ?? ($validated['wallet_id'] ?? null)) : null,
                    'status' => 'pending',
                    'payment_method' => 'cash',
                    'payment_provider' => null,
                    'payment_status' => 'unpaid',
                ]);

                $total = 0;
                $mainCurrency = $this->restaurantCurrency($table->restaurant);
                $exchangeRate = $this->usdCdfRate($table->restaurant);

                foreach ($validated['items'] as $item) {
                    $plat = Plat::query()
                        ->where('restaurant_id', $table->restaurant_id)
                        ->findOrFail($item['plat_id']);

                    if (!$plat->is_available) {
                        throw new \Exception("Le plat {$plat->name} n'est plus disponible.");
                    }

                    $pricing = $this->convertedPlatPricing($plat, $mainCurrency, $exchangeRate);

                    $order->items()->create([
                        'plat_id' => $plat->id,
                        'quantity' => $item['quantity'],
                        'price_at_order' => $pricing['converted_price'],
                        'original_price' => $pricing['original_price'],
                        'original_currency' => $pricing['original_currency'],
                        'converted_price' => $pricing['converted_price'],
                        'conversion_rate' => $pricing['conversion_rate'],
                    ]);

                    $total += ((float) $pricing['converted_price'] * (int) $item['quantity']);
                }

                $order->update([
                    'total_amount' => round($total, 2),
                    'currency' => $mainCurrency,
                    'exchange_rate' => $exchangeRate,
                    'exchange_rate_pair' => 'USD/CDF',
                ]);

                $payment = Payment::create([
                    'restaurant_id' => $table->restaurant_id,
                    'order_id' => $order->id,
                    'type' => 'order',
                    'method' => $order->payment_method,
                    'provider' => $order->payment_provider,
                    'status' => 'unpaid',
                    'amount' => round($total, 2),
                    'currency' => $mainCurrency,
                    'reference' => 'ORD-' . Str::upper(substr($order->id, 0, 8)),
                    'metadata' => [
                        'message' => 'Paiement cash a confirmer par le restaurant.',
                        'email_followup_enabled' => (bool) (($validated['email_receipt_opt_in'] ?? false) || ($validated['email_feedback_opt_in'] ?? false)),
                        'email_receipt_requested' => (bool) ($validated['email_receipt_opt_in'] ?? false),
                        'email_feedback_requested' => (bool) ($validated['email_feedback_opt_in'] ?? false),
                        'email_contact' => $validated['email_contact'] ?? ($validated['customer_email'] ?? null),
                    ],
                ]);

                $paymentResponse = null;

                if ($orderType !== 'remote') {
                    $table->update(['status' => Table::STATUS_OCCUPIED]);
                }

                $this->broadcastSafely(new OrderPlaced($order->load(['table', 'items.plat', 'latestPayment'])));
                $this->notifyAssignedServersSafely($order);

                return response()->json([
                    'message' => 'Commande reussie',
                    'order' => $order->load(['table', 'items.plat', 'latestPayment']),
                    'payment' => $payment->fresh(),
                    'payment_response' => $paymentResponse,
                    'whatsapp_order_url' => $orderType === 'remote' ? $this->whatsappOrderUrl($order) : null,
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

                $this->broadcastSafely(new OrderStatusUpdated($order));

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
                $this->broadcastSafely(new OrderStatusUpdated($order));

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
            'order_type' => 'nullable|string|in:dine_in,takeaway,remote',
            'table_session_token' => 'nullable|string|max:120',
            'wallet_id' => 'nullable|string',
            'customer_name' => 'nullable|string|max:120',
            'customer_phone' => 'nullable|string|max:30',
            'customer_email' => 'nullable|email|max:160',
            'email_contact' => 'nullable|email|max:160',
            'email_receipt_opt_in' => 'nullable|boolean',
            'email_feedback_opt_in' => 'nullable|boolean',
            'items' => 'required|array|min:1',
            'items.*.plat_id' => 'required|uuid|exists:plats,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        try {
            return DB::transaction(function () use ($id, $validated) {
                $order = Order::with(['table.restaurant.plan', 'items.plat', 'latestPayment'])
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

                if (($order->order_type ?? 'dine_in') !== 'remote') {
                    $tableSession = $this->validTableSession($order->table, $validated['table_session_token'] ?? null);
                    if (!$tableSession || ($order->table_session_id && $tableSession->id !== $order->table_session_id)) {
                        return response()->json([
                            'message' => 'Session de table expiree. Veuillez scanner a nouveau le QR code.',
                        ], 422);
                    }
                }

                $total = 0;
                $mainCurrency = $this->restaurantCurrency($order->table?->restaurant ?: $order->restaurant);
                $exchangeRate = $this->usdCdfRate($order->table?->restaurant ?: $order->restaurant);
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

                    $pricing = $this->convertedPlatPricing($plat, $mainCurrency, $exchangeRate);

                    $order->items()->create([
                        'plat_id' => $plat->id,
                        'quantity' => $item['quantity'],
                        'price_at_order' => $pricing['converted_price'],
                        'original_price' => $pricing['original_price'],
                        'original_currency' => $pricing['original_currency'],
                        'converted_price' => $pricing['converted_price'],
                        'conversion_rate' => $pricing['conversion_rate'],
                    ]);

                    $total += ((float) $pricing['converted_price'] * (int) $item['quantity']);
                }

                $nextOrderType = $validated['order_type'] ?? $order->order_type ?? 'dine_in';
                $nextCustomerName = $validated['customer_name'] ?? $order->customer_name;
                $nextCustomerPhone = $validated['customer_phone'] ?? $order->customer_phone;
                $nextCustomerEmail = $validated['customer_email'] ?? ($validated['email_contact'] ?? $order->customer_email);

                $order->update([
                    'note' => $validated['note'] ?? null,
                    'order_type' => $nextOrderType,
                    'pickup_name' => in_array($nextOrderType, ['takeaway', 'remote'], true) ? $nextCustomerName : null,
                    'pickup_phone' => in_array($nextOrderType, ['takeaway', 'remote'], true) ? $nextCustomerPhone : null,
                    'customer_name' => $nextCustomerName,
                    'customer_phone' => $nextCustomerPhone,
                    'customer_email' => $nextCustomerEmail,
                    'total_amount' => round($total, 2),
                    'currency' => $mainCurrency,
                    'exchange_rate' => $exchangeRate,
                    'exchange_rate_pair' => 'USD/CDF',
                ]);

                $paymentResponse = null;
                $payment = $order->latestPayment()->first();

                if ($payment) {
                    $metadata = $payment->metadata ?? [];
                    $metadata['modified_at'] = now()->toIso8601String();
                    $metadata['modification_message'] = 'Commande modifiee par le client avant preparation.';
                    $metadata['email_followup_enabled'] = (bool) (($validated['email_receipt_opt_in'] ?? false) || ($validated['email_feedback_opt_in'] ?? false));
                    $metadata['email_receipt_requested'] = (bool) ($validated['email_receipt_opt_in'] ?? false);
                    $metadata['email_feedback_requested'] = (bool) ($validated['email_feedback_opt_in'] ?? false);
                    $metadata['email_contact'] = $validated['email_contact'] ?? $nextCustomerEmail;

                    if ($order->payment_method === 'mobile_money') {
                        if (!$order->table?->restaurant?->plan?->allows('mobile_money')) {
                            return response()->json([
                                'message' => 'Le paiement Mobile Money est reserve aux plans Pro et Business.',
                                'requires_upgrade' => true,
                            ], 403);
                        }

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
                                'amount' => round($total, 2),
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
                            'amount' => round($total, 2),
                            'currency' => $mainCurrency,
                            'status' => 'unpaid',
                            'metadata' => $metadata,
                            'paid_at' => null,
                        ]);
                        $order->update(['payment_status' => 'unpaid']);
                    }
                }

                $this->broadcastSafely(new OrderStatusUpdated($order));

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

                $metadata = is_array($payment->metadata) ? $payment->metadata : [];

                if (!empty($metadata['bill_requested'])) {
                    return response()->json([
                        'message' => 'Addition déjà demandée.',
                        'order' => $order->fresh(['table', 'items.plat', 'latestPayment']),
                    ]);
                }

                $metadata['bill_requested'] = true;
                $metadata['bill_requested_at'] = now()->toIso8601String();

                $payment->update(['metadata' => $metadata]);
                $freshOrder = $order->fresh(['table', 'items.plat', 'latestPayment']);
                $this->broadcastSafely(new OrderStatusUpdated($freshOrder));

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
                $this->broadcastSafely(new OrderStatusUpdated($order));
                $freshOrder = $order->load(['restaurant', 'table', 'items.plat', 'latestPayment']);

                if ($validated['payment_status'] === 'paid') {
                    DB::afterCommit(fn () => app(OrderEmailFollowupService::class)->sendForPaidOrder($freshOrder));
                }

                return response()->json([
                    'message' => 'Paiement mis a jour avec succes',
                    'order' => $freshOrder,
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
            $this->broadcastSafely(new OrderStatusUpdated($payment->order));

            if ($status === 'paid') {
                $order = $payment->order->load(['restaurant', 'table', 'items.plat', 'latestPayment']);
                app(OrderEmailFollowupService::class)->sendForPaidOrder($order);
            }
        }

        return response()->json(['message' => 'Callback paiement commande traite']);
    }

    public function index(Request $request)
    {
        $restaurant = $request->user()?->restaurant()->with('plan')->first();
        if ($restaurant
            && !$restaurant->plan?->allows('analytics')
            && !$request->boolean('active_only')
            && ($request->has('month') || $request->has('year'))) {
            return response()->json([
                'message' => 'Les statistiques mensuelles et annuelles sont reservees aux plans Pro et Business.',
                'requires_upgrade' => true,
            ], 403);
        }

        $query = Order::with(['table', 'items.plat', 'latestPayment'])
            ->when($request->user()?->restaurant_id, fn ($builder, $restaurantId) => $builder->where('restaurant_id', $restaurantId));

        if ($request->boolean('assigned_to_me')) {
            $email = $this->currentServerEmail($request);

            if (!$email) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereHas('table', function ($tableQuery) use ($email) {
                    $tableQuery
                        ->where('assignment_mode', 'all')
                        ->orWhereNull('assignment_mode')
                        ->orWhere(function ($selectedQuery) use ($email) {
                            $selectedQuery
                                ->where('assignment_mode', 'selected')
                                ->whereJsonContains('assigned_server_emails', $email);
                        });
                });
            }
        }

        if ($request->has('day')) {
            [$start, $end] = $this->localDateRange($request->day);
            $query->whereBetween('created_at', [$start, $end]);
        }

        if ($request->has('month')) {
            [$start, $end] = $this->localMonthRange(
                (int) $request->month,
                (int) $request->get('year', date('Y'))
            );
            $query->whereBetween('created_at', [$start, $end]);
        }

        if ($request->has('year') && !$request->has('month')) {
            [$start, $end] = $this->localYearRange((int) $request->year);
            $query->whereBetween('created_at', [$start, $end]);
        }

        if ($request->boolean('active_only')) {
            $query->whereNotIn('status', ['delivered', 'cancelled']);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    private function currentServerEmail(Request $request): ?string
    {
        $user = $request->user();
        $user?->loadMissing('agent');

        $email = strtolower(trim((string) ($user?->agent?->email ?: $user?->email)));

        return $email !== '' ? $email : null;
    }

    private function localDateRange(string $date): array
    {
        $timezone = config('app.display_timezone', 'Africa/Kinshasa');
        $start = Carbon::parse($date, $timezone)->startOfDay()->timezone(config('app.timezone', 'UTC'));
        $end = Carbon::parse($date, $timezone)->endOfDay()->timezone(config('app.timezone', 'UTC'));

        return [$start, $end];
    }

    private function localMonthRange(int $month, int $year): array
    {
        $timezone = config('app.display_timezone', 'Africa/Kinshasa');
        $date = Carbon::create($year, max(1, min(12, $month)), 1, 0, 0, 0, $timezone);

        return [
            $date->copy()->startOfMonth()->timezone(config('app.timezone', 'UTC')),
            $date->copy()->endOfMonth()->timezone(config('app.timezone', 'UTC')),
        ];
    }

    private function localYearRange(int $year): array
    {
        $timezone = config('app.display_timezone', 'Africa/Kinshasa');
        $date = Carbon::create($year, 1, 1, 0, 0, 0, $timezone);

        return [
            $date->copy()->startOfYear()->timezone(config('app.timezone', 'UTC')),
            $date->copy()->endOfYear()->timezone(config('app.timezone', 'UTC')),
        ];
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
                'message' => 'Entrez le code de suivi, le numéro de téléphone ou scannez une table avec commande active.',
            ], 422);
        }

        $query = Order::with(['restaurant', 'table', 'items.plat', 'latestPayment']);

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
                'message' => 'Pour proteger les clients, le QR de table seul ne restaure pas une commande existante. Entrez le code de suivi ou le numéro de téléphone pour retrouver votre commande.',
                'requires_tracking_code' => true,
            ], 409);
        }

        if (empty($validated['code']) && empty($validated['order_id'])) {
            $query->whereNotIn('status', ['cancelled', 'delivered']);
        }

        $order = $query
            ->latest()
            ->first();

        if (!$order) {
            return response()->json([
                'message' => 'Aucune commande active trouvée avec ces informations.',
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

    private function whatsappOrderUrl(Order $order): ?string
    {
        $order->loadMissing(['restaurant', 'items.plat', 'table']);
        $settings = $order->restaurant?->settings ?? [];
        $phone = $settings['whatsapp_order_phone'] ?? $order->restaurant?->owner_phone;
        $digits = preg_replace('/\D+/', '', (string) $phone);

        if (!$digits) {
            return null;
        }

        if (str_starts_with($digits, '0')) {
            $digits = '243' . substr($digits, 1);
        }

        $items = $order->items->map(function ($item) {
            return "- {$item->quantity} x " . ($item->plat?->name ?? 'Plat');
        })->implode("\n");
        $address = $this->addressFromOrderNote($order->note);
        $note = $this->noteWithoutAddress($order->note);
        $trackingCode = $order->tracking_code ?: Str::upper(substr((string) $order->id, 0, 8));

        $message = "Bonjour, nouvelle commande en ligne.\n"
            . "Restaurant: " . ($order->restaurant?->name ?? '-') . "\n"
            . "Client: " . ($order->customer_name ?: 'Client') . "\n"
            . "Téléphone: " . ($order->customer_phone ?: '-') . "\n"
            . "Adresse: " . ($address ?: '-') . "\n"
            . "Code de suivi: {$trackingCode}\n"
            . "Merci de conserver ce code pour retrouver et suivre cette commande.\n"
            . "Articles:\n{$items}\n"
            . "Total: {$order->total_amount} {$order->currency}\n"
            . "Note: " . ($note ?: '-');

        return 'https://wa.me/' . $digits . '?text=' . rawurlencode($message);
    }

    private function addressFromOrderNote(?string $note): ?string
    {
        if (!$note) {
            return null;
        }

        if (preg_match('/^Adresse client:\s*(.+)$/mi', $note, $matches)) {
            return trim($matches[1]);
        }

        return null;
    }

    private function noteWithoutAddress(?string $note): ?string
    {
        if (!$note) {
            return null;
        }

        $clean = preg_replace('/^Adresse client:.*$/mi', '', $note);
        $clean = trim(preg_replace("/\n{2,}/", "\n", (string) $clean));

        return $clean !== '' ? $clean : null;
    }

    private function broadcastSafely(object $event): void
    {
        try {
            broadcast($event)->toOthers();
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function notifyAssignedServersSafely(Order $order): void
    {
        try {
            $order->loadMissing(['table', 'restaurant']);
            $servers = $this->pushRecipientsForOrder($order);

            if ($servers->isEmpty()) {
                return;
            }

            $tableName = $order->table?->name ?: ($order->order_type === 'remote' ? 'Commande en ligne' : 'Table');
            $amount = number_format((float) $order->total_amount, 0, ',', ' ');
            $currency = $order->currency ?: $order->restaurant?->currency ?: '';

            $this->firebasePushService->sendToUsers(
                $servers,
                'Nouvelle commande',
                trim("{$tableName} - {$amount} {$currency}"),
                [
                    'type' => 'new_order',
                    'order_id' => $order->id,
                    'restaurant_id' => $order->restaurant_id,
                    'table_id' => $order->table_id,
                    'tracking_code' => $order->tracking_code,
                    'status' => $order->status,
                ]
            );
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function pushRecipientsForOrder(Order $order)
    {
        $table = $order->table;

        if (!$table) {
            return collect();
        }

        $query = User::query()
            ->with('agent')
            ->where('restaurant_id', $order->restaurant_id)
            ->where('push_notifications_enabled', true)
            ->whereNotNull('fcm_token');

        if (($table->assignment_mode ?? 'all') === 'selected') {
            $emails = collect($table->assigned_server_emails ?? [])
                ->map(fn ($email) => strtolower(trim((string) $email)))
                ->filter()
                ->unique()
                ->values();

            if ($emails->isEmpty()) {
                return collect();
            }

            $query->where(function ($builder) use ($emails) {
                $builder->whereIn('email', $emails)
                    ->orWhereHas('agent', fn ($agentQuery) => $agentQuery->whereIn('email', $emails));
            });
        }

        return $query->get();
    }

    private function resolveOrderTable(array $validated, string $orderType): Table
    {
        if (!empty($validated['table_id'])) {
            return Table::with('restaurant.plan')->findOrFail($validated['table_id']);
        }

        if ($orderType !== 'remote') {
            throw new \InvalidArgumentException('Scannez une table pour commander sur place ou a emporter.');
        }

        $restaurant = null;
        if (!empty($validated['restaurant_id'])) {
            $restaurant = Restaurant::with('plan')->find($validated['restaurant_id']);
        }
        if (!$restaurant && !empty($validated['restaurant_slug'])) {
            $restaurant = Restaurant::with('plan')->where('slug', $validated['restaurant_slug'])->first();
        }

        if (!$restaurant) {
            throw new \InvalidArgumentException('Restaurant introuvable pour la commande en ligne.');
        }

        return Table::firstOrCreate(
            [
                'restaurant_id' => $restaurant->id,
                'name' => 'Commandes en ligne',
            ],
            [
                'capacity' => 1,
                'status' => 'Libre',
            ]
        )->load('restaurant.plan');
    }

    private function generateTrackingCode(): string
    {
        do {
            $code = Str::upper(Str::random(6));
        } while (Order::where('tracking_code', $code)->exists());

        return $code;
    }

    private function restaurantCurrency(?Restaurant $restaurant): string
    {
        $currency = strtoupper((string) ($restaurant?->currency ?: 'CDF'));
        return in_array($currency, ['CDF', 'USD'], true) ? $currency : 'CDF';
    }

    private function usdCdfRate(?Restaurant $restaurant): float
    {
        $settings = $restaurant?->settings ?? [];
        $rate = (float) ($settings['usd_cdf_rate'] ?? $settings['exchange_rate_usd_cdf'] ?? 2850);

        return $rate > 0 ? $rate : 2850;
    }

    private function convertedPlatPricing(Plat $plat, string $targetCurrency, float $usdCdfRate): array
    {
        $originalCurrency = strtoupper((string) ($plat->currency ?: $targetCurrency));
        $originalCurrency = in_array($originalCurrency, ['CDF', 'USD'], true) ? $originalCurrency : $targetCurrency;
        $originalPrice = round((float) $plat->currentPrice(), 2);
        $conversionRate = $this->conversionRate($originalCurrency, $targetCurrency, $usdCdfRate);
        $convertedPrice = round($originalPrice * $conversionRate, 2);

        return [
            'original_price' => $originalPrice,
            'original_currency' => $originalCurrency,
            'converted_price' => $convertedPrice,
            'conversion_rate' => $conversionRate,
        ];
    }

    private function conversionRate(string $fromCurrency, string $toCurrency, float $usdCdfRate): float
    {
        if ($fromCurrency === $toCurrency) {
            return 1.0;
        }

        if ($fromCurrency === 'USD' && $toCurrency === 'CDF') {
            return $usdCdfRate;
        }

        if ($fromCurrency === 'CDF' && $toCurrency === 'USD') {
            return round(1 / $usdCdfRate, 6);
        }

        return 1.0;
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
            TableSession::query()
                ->where('table_id', $order->table_id)
                ->where('status', TableSession::STATUS_ACTIVE)
                ->update([
                    'status' => TableSession::STATUS_CLOSED,
                    'closed_at' => now(),
                ]);
        }
    }

    private function validTableSession(?Table $table, ?string $token): ?TableSession
    {
        if (!$table || !$token) {
            return null;
        }

        TableSession::query()
            ->where('table_id', $table->id)
            ->where('status', TableSession::STATUS_ACTIVE)
            ->where('expires_at', '<=', now())
            ->update([
                'status' => TableSession::STATUS_EXPIRED,
                'closed_at' => now(),
            ]);

        return TableSession::query()
            ->where('table_id', $table->id)
            ->where('token', $token)
            ->where('status', TableSession::STATUS_ACTIVE)
            ->where('expires_at', '>', now())
            ->first();
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
