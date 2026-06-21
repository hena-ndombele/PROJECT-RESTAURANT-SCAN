<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Agent extends Model
{
    use HasFactory;
    use HasUuids;

    protected $fillable = [
        'restaurant_id',
        'user_id',
        'matricule',
        'first_name',
        'last_name',
        'email',
        'photo',
        'phone_number',
        'address',
        'education_level',
        'fonction',
        'department',
        'status',
        'contract_type',
        'shift',
        'hired_at',
        'emergency_contact_name',
        'emergency_contact_phone',
    ];

    protected $appends = ['photo_url'];

    protected $casts = [
        'hired_at' => 'date',
    ];

    public function getPhotoUrlAttribute(): ?string
    {
        if (!$this->photo) {
            return null;
        }

        return Storage::disk('public')->exists($this->photo)
            ? asset("storage/{$this->photo}")
            : null;
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function restaurant()
    {
        return $this->belongsTo(Restaurant::class);
    }
}
