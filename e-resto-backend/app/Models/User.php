<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens; // si tu utilises Sanctum
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;
    use HasUuids;

    /**
     * Les attributs remplissables (mass assignable).
     */
    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'address',
        'password',
        'restaurant_id',
        'agent_id',
        'otp_code',
        'is_first_login',
        'otp_expires_at',
    ];

    /**
     * Les attributs cachés lors de la sérialisation JSON.
     */

    public function agent()
    {
        return $this->belongsTo(Agent::class);
    }

    public function restaurant()
    {
        return $this->belongsTo(Restaurant::class);
    }
    public function favoriteRestaurants()
    {
        return $this->belongsToMany(Restaurant::class, 'user_restaurant_favorites')
            ->withTimestamps();
    }

    protected $hidden = [
        'password',
        'remember_token',
        'otp_code',
    ];

    /**
     * Les attributs typés.
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'otp_expires_at' => 'datetime',
        'is_first_login' => 'boolean',
    ];
}


