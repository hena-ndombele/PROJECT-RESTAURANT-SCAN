<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $order;
    public ?string $restaurantId;

    public function __construct(Order $order)
    {
        $loadedOrder = $order->loadMissing(['table', 'items.plat', 'latestPayment']);
        $this->restaurantId = $loadedOrder->restaurant_id;

        $this->order = [
            'id' => $loadedOrder->id,
            'table_id' => $loadedOrder->table_id,
            'tracking_code' => $loadedOrder->tracking_code,
            'order_type' => $loadedOrder->order_type,
            'pickup_name' => $loadedOrder->pickup_name,
            'pickup_phone' => $loadedOrder->pickup_phone,
            'customer_name' => $loadedOrder->customer_name,
            'customer_phone' => $loadedOrder->customer_phone,
            'customer_email' => $loadedOrder->customer_email,
            'status' => $loadedOrder->status,
            'payment_status' => $loadedOrder->payment_status,
            'payment_method' => $loadedOrder->payment_method,
            'payment_provider' => $loadedOrder->payment_provider,
            'total_amount' => (float) $loadedOrder->total_amount,
            'currency' => $loadedOrder->currency,
            'note' => $loadedOrder->note,
            'cancellation_reason' => $loadedOrder->cancellation_reason,
            'cancelled_at' => optional($loadedOrder->cancelled_at)->toIso8601String(),
            'table' => $loadedOrder->table,
            'items' => $loadedOrder->items,
            'latest_payment' => $loadedOrder->latestPayment,
            'created_at' => optional($loadedOrder->created_at)->toIso8601String(),
            'updated_at' => optional($loadedOrder->updated_at)->toIso8601String(),
        ];
    }

    public function broadcastOn(): array
    {
        $channels = [
            new Channel("orders.{$this->order['id']}"),
            new Channel('orders'),
        ];

        if ($this->restaurantId) {
            $channels[] = new Channel("orders.{$this->restaurantId}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'order.status.updated';
    }
}
