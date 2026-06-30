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
        'business_owner_user_id',
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

    public function businessOwner()
    {
        return $this->belongsTo(User::class, 'business_owner_user_id');
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function agents()
    {
        return $this->hasMany(Agent::class);
    }

    public function tables()
    {
        return $this->hasMany(Table::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function plats()
    {
        return $this->hasMany(Plat::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function favoritedByUsers()
    {
        return $this->belongsToMany(User::class, 'user_restaurant_favorites')
            ->withTimestamps();
    }
}
