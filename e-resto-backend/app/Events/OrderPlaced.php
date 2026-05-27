<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderPlaced implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $order;

    public function __construct(Order $order)
    {
        $loadedOrder = $order->loadMissing(['table', 'items.plat']);

        $this->order = [
            'id' => $loadedOrder->id,
            'status' => $loadedOrder->status,
            'total_amount' => (float) $loadedOrder->total_amount,
            'currency' => $loadedOrder->currency,
            'note' => $loadedOrder->note,
            'table' => $loadedOrder->table,
            'items' => $loadedOrder->items,
            'created_at' => optional($loadedOrder->created_at)->toIso8601String(),
        ];
    }

    public function broadcastOn(): array
    {
        return [
            new Channel("orders.{$this->order['id']}"),
            new Channel('orders'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'order.placed';
    }
}
