<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Restaurant extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'name',
        'slug',
        'legal_name',
        'owner_name',
        'owner_email',
        'owner_phone',
        'address',
        'city',
        'country',
        'currency',
        'logo',
        'status',
        'saas_plan_id',
        'trial_ends_at',
        'subscription_ends_at',
        'settings',
    ];

    protected $casts = [
        'settings' => 'array',
        'trial_ends_at' => 'datetime',
        'subscription_ends_at' => 'datetime',
    ];

    public function plan()
    {
        return $this->belongsTo(SaasPlan::class, 'saas_plan_id');
    }

    public function subscription()
    {
        return $this->hasOne(RestaurantSubscription::class)->latestOfMany();
    }
}
