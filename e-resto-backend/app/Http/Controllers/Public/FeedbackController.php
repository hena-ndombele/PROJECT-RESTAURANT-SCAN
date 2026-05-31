<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use App\Models\Order;
use Illuminate\Http\Request;

class FeedbackController extends Controller
{
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

        $order = Order::with('table')->findOrFail($validated['order_id']);

        $canGiveFeedback = $order->status === 'delivered'
            || ($order->order_type === 'takeaway' && $order->status === 'ready');

        if (!$canGiveFeedback) {
            return response()->json([
                'message' => "Le feedback est disponible apres service ou quand une commande a emporter est prete.",
            ], 422);
        }

        $feedback = Feedback::updateOrCreate(
            ['order_id' => $order->id],
            [
                'restaurant_id' => $order->restaurant_id,
                'table_id' => $order->table_id,
                'food_rating' => $validated['food_rating'],
                'service_rating' => $validated['service_rating'],
                'ordering_rating' => $validated['ordering_rating'],
                'recommended' => $validated['recommended'],
                'comment' => $validated['comment'] ?? null,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'status' => 'new',
            ]
        );

        return response()->json([
            'message' => 'Merci pour votre avis.',
            'feedback' => $feedback->load(['order.table', 'table']),
        ], 201);
    }

    public function index(Request $request)
    {
        $restaurantId = $request->user()?->restaurant_id;

        return response()->json(
            Feedback::with(['order.table', 'table'])
                ->when($restaurantId, fn ($query) => $query->where('restaurant_id', $restaurantId))
                ->latest()
                ->get()
        );
    }
}
