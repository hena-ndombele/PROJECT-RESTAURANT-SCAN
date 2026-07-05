<?php

namespace App\Http\Controllers\Public;

use App\Events\GroupOrderUpdated;
use App\Events\OrderPlaced;
use App\Http\Controllers\Controller;
use App\Models\GroupOrder;
use App\Models\GroupOrderItem;
use App\Models\GroupOrderParticipant;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plat;
use App\Models\Restaurant;
use App\Models\Table;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class GroupOrderController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'restaurant_id' => 'nullable|uuid|exists:restaurants,id',
            'restaurant_slug' => 'nullable|string|exists:restaurants,slug',
            'table_id' => 'nullable|uuid|exists:tables,id',
            'creator_name' => 'required|string|max:120',
            'creator_phone' => 'nullable|string|max:30',
            'creator_email' => 'nullable|email|max:160',
            'email_receipt_opt_in' => 'nullable|boolean',
            'email_feedback_opt_in' => 'nullable|boolean',
            'note' => 'nullable|string|max:1000',
            'expires_in_minutes' => 'nullable|integer|min:10|max:1440',
        ]);

        if (empty($validated['restaurant_id']) && empty($validated['restaurant_slug']) && empty($validated['table_id'])) {
            return response()->json([
                'message' => 'Choisissez un restaurant ou scannez une table pour créer une commande groupée.',
            ], 422);
        }

        return DB::transaction(function () use ($validated) {
            [$restaurant, $table] = $this->resolveRestaurantAndTable($validated);

            if (!$this->restaurantAcceptsOrders($restaurant)) {
                return response()->json([
                    'message' => "Ce restaurant n'accepte pas de commandes pour le moment.",
                ], 422);
            }

            if (!$this->restaurantAllowsGroupOrders($restaurant)) {
                return response()->json([
                    'message' => 'La commande groupee est reservee aux plans Pro et Business.',
                ], 403);
            }

            $creatorCode = $this->generateCreatorCode();

            $groupOrder = GroupOrder::create([
                'restaurant_id' => $restaurant->id,
                'table_id' => $table?->id,
                'code' => $this->generateCode(),
                'status' => 'open',
                'creator_name' => $validated['creator_name'],
                'creator_phone' => $validated['creator_phone'] ?? null,
                'creator_email' => $validated['creator_email'] ?? null,
                'creator_code_hash' => Hash::make($creatorCode),
                'note' => $validated['note'] ?? null,
                'expires_at' => now()->addMinutes($validated['expires_in_minutes'] ?? 180),
            ]);

            $participant = $groupOrder->participants()->create([
                'name' => $validated['creator_name'],
                'phone' => $validated['creator_phone'] ?? null,
                'email' => $validated['creator_email'] ?? null,
                'email_receipt_requested' => (bool) ($validated['email_receipt_opt_in'] ?? false),
                'email_feedback_requested' => (bool) ($validated['email_feedback_opt_in'] ?? false),
                'is_creator' => true,
                'last_seen_at' => now(),
            ]);

            DB::afterCommit(fn () => broadcast(new GroupOrderUpdated($groupOrder->fresh($this->relations()), 'created')));

            return response()->json([
                'message' => 'Commande groupée créée.',
                'group_order' => $this->groupOrderPayload($groupOrder->fresh($this->relations())),
                'creator_participant' => $participant,
                'creator_code' => $creatorCode,
            ], 201);
        });
    }

    public function show(string $code)
    {
        $groupOrder = $this->findByCode($code);

        return response()->json($this->groupOrderPayload($groupOrder));
    }

    public function activeForTable(Table $table)
    {
        $table->loadMissing('restaurant.plan');
        if (!$table->restaurant || !$this->restaurantAllowsGroupOrders($table->restaurant)) {
            return response()->json([
                'group_order' => null,
            ]);
        }

        $groupOrder = GroupOrder::with($this->relations())
            ->where('table_id', $table->id)
            ->where('status', 'open')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->latest()
            ->first();

        return response()->json([
            'group_order' => $groupOrder ? $this->groupOrderPayload($groupOrder) : null,
        ]);
    }

    public function join(Request $request, string $code)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:160',
            'email_receipt_opt_in' => 'nullable|boolean',
            'email_feedback_opt_in' => 'nullable|boolean',
        ]);

        $groupOrder = $this->findByCode($code);
        $blocked = $this->blockedResponse($groupOrder);
        if ($blocked) {
            return $blocked;
        }

        $participant = $groupOrder->participants()->create([
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'email_receipt_requested' => (bool) ($validated['email_receipt_opt_in'] ?? false),
            'email_feedback_requested' => (bool) ($validated['email_feedback_opt_in'] ?? false),
            'is_creator' => false,
            'last_seen_at' => now(),
        ]);

        DB::afterCommit(fn () => broadcast(new GroupOrderUpdated($groupOrder->fresh($this->relations()), 'joined')));

        return response()->json([
            'message' => 'Participant ajoute.',
            'participant' => $participant,
            'group_order' => $this->groupOrderPayload($groupOrder->fresh($this->relations())),
        ], 201);
    }

    public function heartbeat(Request $request, string $code)
    {
        $validated = $request->validate([
            'participant_id' => 'required|uuid|exists:group_order_participants,id',
        ]);

        $groupOrder = $this->findByCode($code);
        $blocked = $this->blockedResponse($groupOrder);
        if ($blocked) {
            return $blocked;
        }

        $participant = $groupOrder->participants()->findOrFail($validated['participant_id']);
        $participant->update(['last_seen_at' => now()]);

        return response()->json([
            'message' => 'Participant actif.',
            'participant' => $participant->fresh(),
            'group_order' => $this->groupOrderPayload($groupOrder->fresh($this->relations())),
        ]);
    }

    public function setReady(Request $request, string $code)
    {
        $validated = $request->validate([
            'participant_id' => 'required|uuid|exists:group_order_participants,id',
            'is_ready' => 'required|boolean',
            'email' => 'nullable|email|max:160',
            'email_receipt_opt_in' => 'nullable|boolean',
            'email_feedback_opt_in' => 'nullable|boolean',
        ]);

        $groupOrder = $this->findByCode($code);
        $blocked = $this->blockedResponse($groupOrder);
        if ($blocked) {
            return $blocked;
        }

        $participant = $groupOrder->participants()->findOrFail($validated['participant_id']);
        $participant->update([
            'is_ready' => (bool) $validated['is_ready'],
            'email' => $validated['email'] ?? $participant->email,
            'email_receipt_requested' => (bool) ($validated['email_receipt_opt_in'] ?? $participant->email_receipt_requested),
            'email_feedback_requested' => (bool) ($validated['email_feedback_opt_in'] ?? $participant->email_feedback_requested),
            'last_seen_at' => now(),
        ]);
        DB::afterCommit(fn () => broadcast(new GroupOrderUpdated($groupOrder->fresh($this->relations()), 'ready_changed')));

        return response()->json([
            'message' => $participant->is_ready ? 'Participant pret.' : 'Participant en cours.',
            'participant' => $participant->fresh(),
            'group_order' => $this->groupOrderPayload($groupOrder->fresh($this->relations())),
        ]);
    }

    public function recoverCreator(Request $request, string $code)
    {
        $validated = $request->validate([
            'creator_code' => 'required|string|size:4',
        ]);

        $groupOrder = $this->findByCode($code);
        $blocked = $this->blockedResponse($groupOrder);
        if ($blocked) {
            return $blocked;
        }

        if (!$groupOrder->creator_code_hash || !Hash::check($validated['creator_code'], $groupOrder->creator_code_hash)) {
            return response()->json([
                'message' => 'Code créateur incorrect.',
            ], 422);
        }

        $participant = $groupOrder->participants()
            ->where('is_creator', true)
            ->firstOrFail();

        return response()->json([
            'message' => 'Createur recupere.',
            'participant' => $participant,
            'group_order' => $this->groupOrderPayload($groupOrder->fresh($this->relations())),
        ]);
    }

    public function upsertItem(Request $request, string $code)
    {
        $validated = $request->validate([
            'participant_id' => 'required|uuid|exists:group_order_participants,id',
            'plat_id' => 'required|uuid|exists:plats,id',
            'quantity' => 'required|integer|min:1|max:99',
            'note' => 'nullable|string|max:500',
        ]);

        $groupOrder = $this->findByCode($code);
        $blocked = $this->blockedResponse($groupOrder);
        if ($blocked) {
            return $blocked;
        }

        $participant = $groupOrder->participants()->findOrFail($validated['participant_id']);
        $participant->update([
            'is_ready' => false,
            'last_seen_at' => now(),
        ]);

        $plat = Plat::query()
            ->where('restaurant_id', $groupOrder->restaurant_id)
            ->where('is_available', true)
            ->findOrFail($validated['plat_id']);

        $item = GroupOrderItem::updateOrCreate(
            [
                'group_order_id' => $groupOrder->id,
                'group_order_participant_id' => $participant->id,
                'plat_id' => $plat->id,
            ],
            [
                'quantity' => $validated['quantity'],
                'price_at_add' => $plat->currentPrice(),
                'note' => $validated['note'] ?? null,
            ]
        );
        DB::afterCommit(fn () => broadcast(new GroupOrderUpdated($groupOrder->fresh($this->relations()), 'item_updated')));

        return response()->json([
            'message' => 'Plat ajoute a la commande groupée.',
            'item' => $item->load('plat', 'participant'),
            'group_order' => $this->groupOrderPayload($groupOrder->fresh($this->relations())),
        ]);
    }

    public function destroyItem(string $code, GroupOrderItem $item)
    {
        $groupOrder = $this->findByCode($code);
        $blocked = $this->blockedResponse($groupOrder);
        if ($blocked) {
            return $blocked;
        }

        if ($item->group_order_id !== $groupOrder->id) {
            return response()->json(['message' => 'Plat introuvable dans cette commande groupée.'], 404);
        }

        $item->participant?->update([
            'is_ready' => false,
            'last_seen_at' => now(),
        ]);

        $item->delete();
        DB::afterCommit(fn () => broadcast(new GroupOrderUpdated($groupOrder->fresh($this->relations()), 'item_deleted')));

        return response()->json([
            'message' => 'Plat retire de la commande groupée.',
            'group_order' => $this->groupOrderPayload($groupOrder->fresh($this->relations())),
        ]);
    }

    public function whatsapp(string $code)
    {
        $groupOrder = $this->findByCode($code);

        return response()->json([
            'whatsapp_order_url' => $this->whatsappOrderUrl($groupOrder),
            'message_preview' => $this->whatsappMessage($groupOrder),
        ]);
    }

    public function checkout(Request $request, string $code)
    {
        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:120',
            'customer_phone' => 'nullable|string|max:30',
            'customer_email' => 'nullable|email|max:160',
            'email_contact' => 'nullable|email|max:160',
            'email_receipt_opt_in' => 'nullable|boolean',
            'email_feedback_opt_in' => 'nullable|boolean',
            'note' => 'nullable|string|max:1000',
        ]);

        $groupOrder = $this->findByCode($code);
        $blocked = $this->blockedResponse($groupOrder);
        if ($blocked) {
            return $blocked;
        }

        if ($groupOrder->items()->count() === 0) {
            return response()->json([
                'message' => 'Ajoutez au moins un plat avant de valider la commande groupée.',
            ], 422);
        }

        return DB::transaction(function () use ($groupOrder, $validated) {
            $lockedGroupOrder = GroupOrder::with($this->relations())
                ->whereKey($groupOrder->id)
                ->lockForUpdate()
                ->firstOrFail();

            $blocked = $this->blockedResponse($lockedGroupOrder);
            if ($blocked) {
                return $blocked;
            }

            $readiness = $this->readinessState($lockedGroupOrder);
            if (!$readiness['can_checkout']) {
                return response()->json([
                    'message' => 'Tous les participants actifs doivent cliquer sur "J\'ai termine" avant l\'envoi.',
                    'readiness' => $readiness,
                    'group_order' => $this->groupOrderPayload($lockedGroupOrder),
                ], 422);
            }

            $table = $lockedGroupOrder->table ?: $this->remoteTable($lockedGroupOrder->restaurant);
            $monthlyLimit = $lockedGroupOrder->restaurant->plan?->maxOrdersPerMonth();
            if ($monthlyLimit !== null) {
                $ordersThisMonth = $lockedGroupOrder->restaurant->orders()
                    ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
                    ->count();
                if ($ordersThisMonth >= $monthlyLimit) {
                    return response()->json([
                        'message' => "Limite de {$monthlyLimit} commandes mensuelles atteinte pour le plan {$lockedGroupOrder->restaurant->plan?->name}.",
                        'requires_upgrade' => true,
                    ], 403);
                }
            }

            $total = 0;
            $currency = $lockedGroupOrder->restaurant->currency ?? 'CDF';
            $itemsByPlat = $lockedGroupOrder->items
                ->groupBy('plat_id')
                ->map(fn ($items) => [
                    'plat' => $items->first()->plat,
                    'quantity' => $items->sum('quantity'),
                ]);

            $order = Order::create([
                'tracking_code' => $this->generateTrackingCode(),
                'table_id' => $table->id,
                'restaurant_id' => $lockedGroupOrder->restaurant_id,
                'order_type' => $lockedGroupOrder->table_id ? 'dine_in' : 'remote',
                'note' => trim(($validated['note'] ?? '') . "\n\n" . $this->groupOrderNote($lockedGroupOrder)),
                'customer_name' => $validated['customer_name'] ?? $lockedGroupOrder->creator_name,
                'customer_phone' => $validated['customer_phone'] ?? $lockedGroupOrder->creator_phone,
                'customer_email' => $validated['customer_email'] ?? $lockedGroupOrder->creator_email,
                'pickup_name' => $validated['customer_name'] ?? $lockedGroupOrder->creator_name,
                'pickup_phone' => $validated['customer_phone'] ?? $lockedGroupOrder->creator_phone,
                'status' => 'pending',
                'payment_method' => 'cash',
                'payment_provider' => null,
                'payment_status' => 'unpaid',
            ]);

            foreach ($itemsByPlat as $row) {
                $plat = $row['plat'];
                if (!$plat || !$plat->is_available) {
                    throw new \RuntimeException("Un plat de cette commande n'est plus disponible.");
                }

                $price = $plat->currentPrice();

                $order->items()->create([
                    'plat_id' => $plat->id,
                    'quantity' => $row['quantity'],
                    'price_at_order' => $price,
                ]);

                $total += (float) $price * (int) $row['quantity'];
                $currency = $plat->currency;
            }

            $order->update([
                'total_amount' => $total,
                'currency' => $currency,
            ]);

            $payment = Payment::create([
                'restaurant_id' => $lockedGroupOrder->restaurant_id,
                'order_id' => $order->id,
                'type' => 'order',
                'method' => 'cash',
                'status' => 'unpaid',
                'amount' => $total,
                'currency' => $currency,
                'reference' => 'ORD-' . Str::upper(substr($order->id, 0, 8)),
                'metadata' => [
                    'group_order_id' => $lockedGroupOrder->id,
                    'group_order_code' => $lockedGroupOrder->code,
                    'message' => 'Paiement cash a confirmer par le restaurant.',
                    'email_followup_enabled' => (bool) (($validated['email_receipt_opt_in'] ?? false) || ($validated['email_feedback_opt_in'] ?? false)),
                    'email_receipt_requested' => (bool) ($validated['email_receipt_opt_in'] ?? false),
                    'email_feedback_requested' => (bool) ($validated['email_feedback_opt_in'] ?? false),
                    'email_contact' => $validated['email_contact'] ?? ($validated['customer_email'] ?? null),
                    'group_participant_email_followups' => $this->participantEmailFollowups($lockedGroupOrder),
                ],
            ]);

            if ($lockedGroupOrder->table_id) {
                $table->update(['status' => Table::STATUS_OCCUPIED]);
            }

            $lockedGroupOrder->update([
                'order_id' => $order->id,
                'status' => 'checked_out',
                'checked_out_at' => now(),
            ]);

            $freshOrder = $order->load(['table', 'items.plat', 'latestPayment']);
            $this->broadcastSafely(new OrderPlaced($freshOrder));
            DB::afterCommit(fn () => broadcast(new GroupOrderUpdated($lockedGroupOrder->fresh($this->relations()), 'checked_out')));

            return response()->json([
                'message' => 'Commande groupée validée.',
                'order' => $freshOrder,
                'payment' => $payment->fresh(),
                'group_order' => $this->groupOrderPayload($lockedGroupOrder->fresh($this->relations())),
                'whatsapp_order_url' => $this->whatsappOrderUrl($lockedGroupOrder->fresh($this->relations())),
            ], 201);
        });
    }

    private function resolveRestaurantAndTable(array $validated): array
    {
        $table = null;
        if (!empty($validated['table_id'])) {
            $table = Table::with('restaurant')->findOrFail($validated['table_id']);
            return [$table->restaurant, $table];
        }

        $restaurant = !empty($validated['restaurant_id'])
            ? Restaurant::findOrFail($validated['restaurant_id'])
            : Restaurant::where('slug', $validated['restaurant_slug'])->firstOrFail();

        return [$restaurant, null];
    }

    private function restaurantAcceptsOrders(Restaurant $restaurant): bool
    {
        return in_array($restaurant->status, ['active', 'trial'], true);
    }

    private function restaurantAllowsGroupOrders(Restaurant $restaurant): bool
    {
        $restaurant->loadMissing('plan');

        return (bool) $restaurant->plan?->allows('group_orders');
    }

    private function findByCode(string $code): GroupOrder
    {
        return GroupOrder::with($this->relations())
            ->where('code', Str::upper($code))
            ->firstOrFail();
    }

    private function blockedResponse(GroupOrder $groupOrder)
    {
        if ($groupOrder->restaurant && !$this->restaurantAllowsGroupOrders($groupOrder->restaurant)) {
            return response()->json([
                'message' => 'La commande groupee est reservee aux plans Pro et Business.',
            ], 403);
        }

        if ($groupOrder->status !== 'open') {
            return response()->json([
                'message' => 'Cette commande groupée est déjà cloturée.',
            ], 422);
        }

        if ($groupOrder->expires_at && $groupOrder->expires_at->isPast()) {
            $groupOrder->update(['status' => 'expired']);

            return response()->json([
                'message' => 'Cette commande groupée a expiré.',
            ], 422);
        }

        return null;
    }

    private function relations(): array
    {
        return [
            'restaurant.plan',
            'table',
            'participants.items.plat.category',
            'items.plat.category',
            'items.participant',
            'order.items.plat',
        ];
    }

    private function groupOrderPayload(GroupOrder $groupOrder): array
    {
        $total = $groupOrder->items->sum(fn ($item) => (float) $item->price_at_add * (int) $item->quantity);
        $currency = $groupOrder->items->first()?->plat?->currency ?? $groupOrder->restaurant?->currency ?? 'CDF';
        $readiness = $this->readinessState($groupOrder);

        return [
            'id' => $groupOrder->id,
            'code' => $groupOrder->code,
            'status' => $groupOrder->status,
            'restaurant' => $groupOrder->restaurant ? [
                'id' => $groupOrder->restaurant->id,
                'name' => $groupOrder->restaurant->name,
                'slug' => $groupOrder->restaurant->slug,
                'currency' => $groupOrder->restaurant->currency,
                'logo_url' => $groupOrder->restaurant->logo ? asset("storage/{$groupOrder->restaurant->logo}") : null,
            ] : null,
            'table' => $groupOrder->table ? [
                'id' => $groupOrder->table->id,
                'name' => $groupOrder->table->name,
                'status' => $groupOrder->table->status,
            ] : null,
            'creator_name' => $groupOrder->creator_name,
            'creator_phone' => $groupOrder->creator_phone,
            'note' => $groupOrder->note,
            'expires_at' => $groupOrder->expires_at?->toIso8601String(),
            'checked_out_at' => $groupOrder->checked_out_at?->toIso8601String(),
            'order_id' => $groupOrder->order_id,
            'total_amount' => $total,
            'currency' => $currency,
            'can_checkout' => $readiness['can_checkout'],
            'readiness' => $readiness,
            'participants' => $groupOrder->participants->map(fn ($participant) => [
                'id' => $participant->id,
                'name' => $participant->name,
                'phone' => $participant->phone,
                'email' => null,
                'has_email_followup' => (bool) ($participant->email && ($participant->email_receipt_requested || $participant->email_feedback_requested)),
                'email_receipt_requested' => (bool) $participant->email_receipt_requested,
                'email_feedback_requested' => (bool) $participant->email_feedback_requested,
                'is_creator' => $participant->is_creator,
                'is_ready' => (bool) $participant->is_ready,
                'is_active' => $this->participantIsActive($participant),
                'last_seen_at' => $participant->last_seen_at?->toIso8601String(),
                'items' => $participant->items->map(fn ($item) => $this->itemPayload($item))->values(),
            ])->values(),
            'items' => $groupOrder->items->map(fn ($item) => $this->itemPayload($item))->values(),
        ];
    }

    private function participantEmailFollowups(GroupOrder $groupOrder): array
    {
        return $groupOrder->participants
            ->filter(fn ($participant) => $participant->email && ($participant->email_receipt_requested || $participant->email_feedback_requested))
            ->map(fn ($participant) => [
                'participant_id' => $participant->id,
                'name' => $participant->name,
                'email' => $participant->email,
                'receipt' => (bool) $participant->email_receipt_requested,
                'feedback' => (bool) $participant->email_feedback_requested,
            ])
            ->values()
            ->all();
    }

    private function itemPayload(GroupOrderItem $item): array
    {
        return [
            'id' => $item->id,
            'participant_id' => $item->group_order_participant_id,
            'participant_name' => $item->participant?->name,
            'plat_id' => $item->plat_id,
            'name' => $item->plat?->name,
            'quantity' => $item->quantity,
            'price' => (float) $item->price_at_add,
            'subtotal' => (float) $item->price_at_add * (int) $item->quantity,
            'note' => $item->note,
            'category' => $item->plat?->category ? [
                'id' => $item->plat->category->id,
                'name' => $item->plat->category->name,
            ] : null,
            'image_url' => $item->plat?->image ? asset("storage/{$item->plat->image}") : null,
        ];
    }

    private function readinessState(GroupOrder $groupOrder): array
    {
        $participants = $groupOrder->participants;
        $activeParticipants = $participants->filter(fn ($participant) => $this->participantIsActive($participant));
        $readyParticipants = $activeParticipants->filter(function ($participant) {
            return $participant->is_ready && $participant->items->sum('quantity') > 0;
        });
        $waitingParticipants = $activeParticipants
            ->filter(fn ($participant) => !$participant->is_ready || $participant->items->sum('quantity') <= 0)
            ->values();

        return [
            'active_timeout_seconds' => 120,
            'participants_count' => $participants->count(),
            'active_count' => $activeParticipants->count(),
            'ready_count' => $readyParticipants->count(),
            'waiting_count' => $waitingParticipants->count(),
            'waiting_participants' => $waitingParticipants->map(fn ($participant) => [
                'id' => $participant->id,
                'name' => $participant->name,
            ])->values(),
            'can_checkout' => $groupOrder->items->count() > 0
                && $activeParticipants->count() > 0
                && $waitingParticipants->count() === 0,
        ];
    }

    private function participantIsActive(GroupOrderParticipant $participant): bool
    {
        if (!$participant->last_seen_at) {
            return false;
        }

        return $participant->last_seen_at->greaterThanOrEqualTo(now()->subSeconds(120));
    }

    private function groupOrderNote(GroupOrder $groupOrder): string
    {
        $lines = ["Commande groupée #{$groupOrder->code}"];

        if ($groupOrder->note) {
            $lines[] = "Note groupe: {$groupOrder->note}";
        }

        foreach ($groupOrder->participants as $participant) {
            $lines[] = '';
            $lines[] = "{$participant->name}:";
            foreach ($participant->items as $item) {
                $line = "- {$item->quantity} x " . ($item->plat?->name ?? 'Plat');
                if ($item->note) {
                    $line .= " ({$item->note})";
                }
                $lines[] = $line;
            }
        }

        return implode("\n", $lines);
    }

    private function whatsappOrderUrl(GroupOrder $groupOrder): ?string
    {
        $phone = ($groupOrder->restaurant?->settings ?? [])['whatsapp_order_phone']
            ?? $groupOrder->restaurant?->owner_phone;
        $digits = preg_replace('/\D+/', '', (string) $phone);

        if (!$digits) {
            return null;
        }

        if (str_starts_with($digits, '0')) {
            $digits = '243' . substr($digits, 1);
        }

        return 'https://wa.me/' . $digits . '?text=' . rawurlencode($this->whatsappMessage($groupOrder));
    }

    private function whatsappMessage(GroupOrder $groupOrder): string
    {
        $groupOrder->loadMissing($this->relations());
        $total = $groupOrder->items->sum(fn ($item) => (float) $item->price_at_add * (int) $item->quantity);
        $currency = $groupOrder->items->first()?->plat?->currency ?? $groupOrder->restaurant?->currency ?? 'CDF';

        return "Bonjour, nouvelle commande groupée Restaurant Scan.\n"
            . "Restaurant: " . ($groupOrder->restaurant?->name ?? '-') . "\n"
            . "Groupe: #{$groupOrder->code}\n"
            . "Client principal: {$groupOrder->creator_name}\n"
            . "Téléphone: " . ($groupOrder->creator_phone ?: '-') . "\n"
            . "Table/QR: " . ($groupOrder->table?->name ?: '-') . "\n\n"
            . $this->groupOrderNote($groupOrder) . "\n\n"
            . "Total: {$total} {$currency}";
    }

    private function remoteTable(Restaurant $restaurant): Table
    {
        return Table::firstOrCreate(
            [
                'restaurant_id' => $restaurant->id,
                'name' => 'Commandes hors restaurant',
            ],
            [
                'capacity' => 1,
                'status' => Table::STATUS_FREE,
            ]
        );
    }

    private function generateCode(): string
    {
        do {
            $code = Str::upper(Str::random(8));
        } while (GroupOrder::where('code', $code)->exists());

        return $code;
    }

    private function generateTrackingCode(): string
    {
        do {
            $code = Str::upper(Str::random(6));
        } while (Order::where('tracking_code', $code)->exists());

        return $code;
    }

    private function generateCreatorCode(): string
    {
        return (string) random_int(1000, 9999);
    }

    private function broadcastSafely(object $event): void
    {
        try {
            broadcast($event)->toOthers();
        } catch (\Throwable $exception) {
            report($exception);
        }
    }
}
