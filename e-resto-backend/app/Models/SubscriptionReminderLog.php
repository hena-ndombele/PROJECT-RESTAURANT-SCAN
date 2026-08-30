<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SubscriptionReminderLog extends Model
{
    use HasUuids;

    protected $fillable = [
        'restaurant_id',
        'type',
        'target_date',
        'recipient',
        'sent_at',
    ];

    protected $casts = [
        'target_date' => 'date',
        'sent_at' => 'datetime',
    ];
}
