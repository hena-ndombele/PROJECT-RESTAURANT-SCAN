<?php

namespace App\Events;

use App\Models\GroupOrder;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GroupOrderUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $groupOrder;

    public function __construct(GroupOrder $groupOrder, public string $action = 'updated')
    {
        $loadedGroupOrder = $groupOrder->loadMissing([
            'restaurant',
            'table',
            'participants.items.plat.category',
            'items.plat.category',
            'items.participant',
        ]);

        $this->groupOrder = [
            'id' => $loadedGroupOrder->id,
            'code' => $loadedGroupOrder->code,
            'status' => $loadedGroupOrder->status,
            'restaurant_id' => $loadedGroupOrder->restaurant_id,
            'table_id' => $loadedGroupOrder->table_id,
            'creator_name' => $loadedGroupOrder->creator_name,
            'expires_at' => $loadedGroupOrder->expires_at?->toIso8601String(),
            'checked_out_at' => $loadedGroupOrder->checked_out_at?->toIso8601String(),
            'order_id' => $loadedGroupOrder->order_id,
            'participants_count' => $loadedGroupOrder->participants->count(),
        ];
    }

    public function broadcastOn(): array
    {
        $channels = [];

        if ($this->groupOrder['table_id']) {
            $channels[] = new Channel("group-orders.table.{$this->groupOrder['table_id']}");
        }

        if ($this->groupOrder['restaurant_id']) {
            $channels[] = new Channel("group-orders.restaurant.{$this->groupOrder['restaurant_id']}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'group-order.updated';
    }
}
