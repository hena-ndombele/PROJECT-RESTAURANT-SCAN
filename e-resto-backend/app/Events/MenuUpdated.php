<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MenuUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $restaurantId,
        public string $reason = 'menu_updated'
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new Channel("menu.{$this->restaurantId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'menu.updated';
    }
}
