<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids; // Import indispensable pour l'UUID

class Otp extends Model
{
    use HasFactory, HasUuids; // On utilise le trait ici

    // On précise que l'ID n'est pas un entier qui s'incrémente
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'code',
        'expires_at',
    ];

    /**
     * Relation : Un code OTP appartient à un Utilisateur
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
