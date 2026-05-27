<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Table extends Model
{
    use HasFactory;
    use HasUuids;

    // Définition des statuts pour une utilisation propre dans le code
    const STATUS_FREE = 'Libre';
    const STATUS_OCCUPIED = 'Occupée';
    const STATUS_ORDERING = 'Commande en cours';

    protected $fillable = [
        'name',
        'capacity',    // Ajouté
        'status',      // Ajouté
        'qr_code',

    ];
protected $keyType = 'string';
    public $incrementing = false;
    /**
     * Valeurs par défaut pour les attributs
     */
    protected $attributes = [
        'status' => self::STATUS_FREE,
    ];

    /**
     * Relation avec les commandes
     */
    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    /**
     * Helper pour vérifier si la table est disponible
     */
    public function isFree()
    {
        return $this->status === self::STATUS_FREE;
    }
}
