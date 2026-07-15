<?php

namespace App\Events;

use App\Models\Feedback;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class FeedbackCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $feedback;
    public ?string $restaurantId;

    public function __construct(Feedback $feedback)
    {
        $loadedFeedback = $feedback->loadMissing(['order.table', 'table']);
        $this->restaurantId = $loadedFeedback->restaurant_id;
        $this->feedback = $loadedFeedback->toArray();
    }

    public function broadcastOn(): array
    {
        $channels = [new Channel('feedbacks')];

        if ($this->restaurantId) {
            $channels[] = new Channel("feedbacks.{$this->restaurantId}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'feedback.created';
    }
}
