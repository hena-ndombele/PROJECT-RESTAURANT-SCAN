<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use App\Models\Order;
use App\Models\Restaurant;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class FeedbackController extends Controller
{
    public function availability(Request $request)
    {
        $validated = $request->validate([
            'order_id' => 'required|uuid|exists:orders,id',
        ]);

        $order = Order::with(['table', 'latestPayment'])->findOrFail($validated['order_id']);
        $restaurant = Restaurant::with('plan')->find($order->restaurant_id);
        $availability = $this->feedbackAvailability($order, $restaurant);

        return response()->json($availability);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'order_id' => 'required|uuid|exists:orders,id',
            'food_rating' => 'required|integer|min:1|max:5',
            'service_rating' => 'required|integer|min:1|max:5',
            'ordering_rating' => 'required|integer|min:1|max:5',
            'recommended' => 'required|boolean',
            'comment' => 'nullable|string|max:1500',
        ]);

        $order = Order::with(['table', 'latestPayment'])->findOrFail($validated['order_id']);
        $restaurant = Restaurant::with('plan')->find($order->restaurant_id);
        $availability = $this->feedbackAvailability($order, $restaurant);

        if (!($availability['can_submit'] ?? false)) {
            return response()->json([
                'message' => $availability['message'],
                'reason' => $availability['reason'],
                'expires_at' => $availability['expires_at'] ?? null,
            ], $availability['status_code'] ?? 422);
        }

        try {
            $feedback = Feedback::create([
                'restaurant_id' => $order->restaurant_id,
                'table_id' => $order->table_id,
                'order_id' => $order->id,
                'food_rating' => $validated['food_rating'],
                'service_rating' => $validated['service_rating'],
                'ordering_rating' => $validated['ordering_rating'],
                'recommended' => $validated['recommended'],
                'comment' => $validated['comment'] ?? null,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'status' => 'new',
            ]);
        } catch (QueryException $exception) {
            if (str_contains($exception->getMessage(), 'feedbacks_order_id_unique')) {
                return response()->json([
                    'message' => 'Un avis a déjà été envoyé pour cette commande.',
                    'reason' => 'already_submitted',
                ], 409);
            }

            throw $exception;
        }

        return response()->json([
            'message' => 'Merci pour votre avis.',
            'feedback' => $feedback->load(['order.table', 'table']),
        ], 201);
    }

    public function index(Request $request)
    {
        $restaurantId = $request->user()?->restaurant_id;
        $restaurant = $restaurantId ? Restaurant::with('plan')->find($restaurantId) : null;

        if (!$restaurant?->plan?->allows('feedback')) {
            return response()->json([
                'message' => 'Les avis clients sont reserves aux plans Pro et Business.',
                'requires_upgrade' => true,
            ], 403);
        }

        return response()->json(
            Feedback::with(['order.table', 'table'])
                ->when($restaurantId, fn ($query) => $query->where('restaurant_id', $restaurantId))
                ->latest()
                ->get()
        );
    }

    private function feedbackAvailability(Order $order, ?Restaurant $restaurant): array
    {
        if (!$restaurant?->plan?->allows('feedback')) {
            return [
                'can_submit' => false,
                'reason' => 'feature_unavailable',
                'message' => 'Les avis clients sont reserves aux plans Pro et Business.',
                'status_code' => 403,
            ];
        }

        if (Feedback::where('order_id', $order->id)->exists()) {
            return [
                'can_submit' => false,
                'reason' => 'already_submitted',
                'message' => 'Un avis a déjà été envoyé pour cette commande.',
                'status_code' => 409,
            ];
        }

        $canGiveFeedback = $order->payment_status === 'paid';

        if (!$canGiveFeedback) {
            return [
                'can_submit' => false,
                'reason' => 'not_ready',
                'message' => "Le feedback est disponible uniquement apres confirmation du paiement.",
                'status_code' => 422,
            ];
        }

        $expiresAt = $this->feedbackExpiresAt($order);
        if (now()->greaterThan($expiresAt)) {
            return [
                'can_submit' => false,
                'reason' => 'expired',
                'message' => 'Le lien avis a expire. Les avis sont disponibles pendant 24h apres la commande ou apres l envoi du mail.',
                'expires_at' => $expiresAt->toIso8601String(),
                'status_code' => 410,
            ];
        }

        return [
            'can_submit' => true,
            'reason' => 'available',
            'message' => 'Avis disponible.',
            'expires_at' => $expiresAt->toIso8601String(),
            'status_code' => 200,
        ];
    }

    private function feedbackExpiresAt(Order $order): Carbon
    {
        $metadata = $order->latestPayment?->metadata ?? [];
        $sentAt = $metadata['email_followup_sent_at'] ?? null;

        if ($sentAt) {
            try {
                return Carbon::parse($sentAt)->addDay();
            } catch (\Throwable) {
                // Fallback below when metadata contains an invalid date.
            }
        }

        return ($order->latestPayment?->paid_at ?? $order->created_at ?? now())->copy()->addDay();
    }
}
