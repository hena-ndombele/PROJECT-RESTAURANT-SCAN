<?php

namespace App\Events;

use App\Models\Reservation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReservationChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $reservation;
    public string $action;
    public ?string $restaurantId;

    public function __construct(Reservation $reservation, string $action = 'updated')
    {
        $loadedReservation = $reservation->loadMissing(['table', 'restaurant']);
        $this->restaurantId = $loadedReservation->restaurant_id;
        $this->action = $action;

        $this->reservation = [
            'id' => $loadedReservation->id,
            'restaurant_id' => $loadedReservation->restaurant_id,
            'table_id' => $loadedReservation->table_id,
            'name' => $loadedReservation->name,
            'phone' => $loadedReservation->phone,
            'email' => $loadedReservation->email,
            'guests' => $loadedReservation->guests,
            'reservation_date' => optional($loadedReservation->reservation_date)->format('Y-m-d'),
            'reservation_time' => $loadedReservation->reservation_time,
            'special_requests' => $loadedReservation->special_requests,
            'internal_note' => $loadedReservation->internal_note,
            'cancellation_reason' => $loadedReservation->cancellation_reason,
            'status' => $loadedReservation->status,
            'source' => $loadedReservation->source,
            'created_at' => optional($loadedReservation->created_at)->toIso8601String(),
            'table' => $loadedReservation->table,
        ];
    }

    public function broadcastOn(): array
    {
        $channels = [
            new Channel('reservations'),
            new Channel('Réservations'),
        ];

        if ($this->restaurantId) {
            $channels[] = new Channel("reservations.{$this->restaurantId}");
            $channels[] = new Channel("Réservations.{$this->restaurantId}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return "reservation.{$this->action}";
    }
}
