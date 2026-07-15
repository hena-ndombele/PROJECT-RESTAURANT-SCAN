<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BusinessRestaurantsUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $businessOwnerId,
        public string $action,
        public ?string $restaurantId = null,
        public array $payload = []
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new Channel("business-restaurants.{$this->businessOwnerId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'business-restaurants.updated';
    }
}
