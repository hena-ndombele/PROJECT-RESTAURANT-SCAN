<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

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
        'commune',
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

    protected $appends = ['logo_url'];

    public function getLogoUrlAttribute(): ?string
    {
        if (!$this->logo) {
            return null;
        }

        if (str_starts_with($this->logo, 'http://') || str_starts_with($this->logo, 'https://')) {
            return $this->logo;
        }

        return Storage::disk('public')->exists($this->logo)
            ? asset("storage/{$this->logo}")
            : null;
    }

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

    public function tableSessions()
    {
        return $this->hasMany(TableSession::class);
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
