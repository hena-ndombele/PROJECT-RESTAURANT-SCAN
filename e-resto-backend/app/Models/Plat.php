<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Plat extends Model
{
    use HasFactory;

    /**
     * Liste des champs assignables en masse.
     * Ajout de la devise, du temps de préparation, des ingrédients et de la disponibilité.
     */
    protected $fillable = [
        'restaurant_id',
        'name', 
        'description', 
        'price', 
        'currency',           // Devise (USD/CDF)
        'preparation_time',   // Temps en minutes
        'ingredients',        // Tableau JSON des tags
        'is_available',       // Statut de stock
        'image',              // Image principale
        'image_secondaire_1', 
        'image_secondaire_2', 
        'category_id'
    ];

    /**
     * Conversion automatique des types de données.
     */
    protected $casts = [
        'ingredients' => 'array',     // Transforme le JSON de la DB en tableau PHP
        'is_available' => 'boolean',  // Assure le type booléen
        'preparation_time' => 'integer',
        'price' => 'decimal:2'
    ];

    // Désactiver l'auto-incrémentation pour l'UUID
    public $incrementing = false;

    // Spécifier que la clé primaire est un string (UUID)
    protected $keyType = 'string';

    /**
     * Génération automatique de l'UUID à la création.
     */
    protected static function booted()
    {
        static::creating(function ($plat) {
            if (empty($plat->id)) {
                $plat->id = (string) Str::uuid();
            }
        });
    }

    /**
     * Relation avec la catégorie.
     */
    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function restaurant()
    {
        return $this->belongsTo(Restaurant::class);
    }
}
