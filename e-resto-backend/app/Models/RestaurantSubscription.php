<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RestaurantSubscription extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'restaurant_id',
        'saas_plan_id',
        'status',
        'starts_at',
        'ends_at',
        'next_billing_at',
        'amount',
        'currency',
    ];

    protected $casts = [
        'starts_at' => 'date',
        'ends_at' => 'date',
        'next_billing_at' => 'date',
        'amount' => 'decimal:2',
    ];
}
