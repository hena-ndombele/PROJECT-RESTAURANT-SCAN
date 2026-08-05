<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Table extends Model
{
    use HasFactory;
    use HasUuids;

    // Definition des statuts pour une utilisation propre dans le code
    const STATUS_FREE = 'Libre';
    const STATUS_OCCUPIED = "Occup\u{00E9}e";
    const STATUS_RESERVED = "R\u{00E9}serv\u{00E9}e";
    const STATUS_ORDERING = 'Commande en cours';

    protected $fillable = [
        'restaurant_id',
        'name',
        'capacity',    // Ajouté
        'status',      // Ajouté
        'qr_code',
        'server_phone',
        'assignment_mode',
        'assigned_server_emails',

    ];
protected $keyType = 'string';
    public $incrementing = false;

    protected $casts = [
        'assigned_server_emails' => 'array',
    ];
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

    public function sessions()
    {
        return $this->hasMany(TableSession::class);
    }

    public function restaurant()
    {
        return $this->belongsTo(Restaurant::class);
    }

    /**
     * Helper pour vérifier si la table est disponible
     */
    public function isFree()
    {
        return $this->status === self::STATUS_FREE;
    }
}
