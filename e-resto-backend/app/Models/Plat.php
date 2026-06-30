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
        'promotion_percent',
        'promotion_ends_at',
        'currency',           // Devise (USD/CDF)
        'preparation_time',   // Temps en minutes
        'ingredients',        // Tableau JSON des tags
        'sizes',              // Tailles optionnelles
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
        'sizes' => 'array',
        'is_available' => 'boolean',  // Assure le type booléen
        'preparation_time' => 'integer',
        'price' => 'decimal:2',
        'promotion_percent' => 'integer',
        'promotion_ends_at' => 'datetime',
    ];

    protected $appends = [
        'is_promotion_active',
        'promotion_price',
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

    public function promotionIsActive(): bool
    {
        $percent = (int) ($this->promotion_percent ?? 0);

        return $percent > 0
            && $percent < 100
            && $this->restaurantAllowsPromotions()
            && (!$this->promotion_ends_at || $this->promotion_ends_at->endOfDay()->isFuture());
    }

    public function currentPrice(): float
    {
        if (!$this->promotionIsActive()) {
            return (float) $this->price;
        }

        return round((float) $this->price * (1 - ($this->promotion_percent / 100)), 2);
    }

    public function getIsPromotionActiveAttribute(): bool
    {
        return $this->promotionIsActive();
    }

    public function getPromotionPriceAttribute(): ?float
    {
        return $this->promotionIsActive() ? $this->currentPrice() : null;
    }

    private function restaurantAllowsPromotions(): bool
    {
        $restaurant = $this->relationLoaded('restaurant')
            ? $this->restaurant
            : $this->restaurant()->with('plan')->first();

        return (bool) $restaurant?->plan?->allows('dish_promotions');
    }
}
