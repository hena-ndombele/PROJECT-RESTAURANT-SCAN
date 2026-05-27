<?php

namespace App\Models;

// AJOUTE CETTE LIGNE CI-DESSOUS (Elle manquait)
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Agent extends Model
{
    // Maintenant, Laravel saura où trouver ce trait
    use HasFactory;
    use HasUuids;

    // Champs autorisés lors de la création/mise à jour
    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'address',
        'education_level',
        'fonction',
    ];

    /**
     * Relation : Un Agent appartient à un Utilisateur (User)
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
