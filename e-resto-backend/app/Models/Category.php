<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str; // 1. Importation nécessaire pour générer l'UUID

class Category extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'description', 'image'];

    // 2. Indique à Eloquent que l'ID n'est pas un entier auto-incrémenté
    public $incrementing = false;

    // 3. Spécifie que le type de la clé primaire est une chaîne de caractères
    protected $keyType = 'string';

    /**
     * 4. Utilise la méthode booted pour générer l'UUID lors de la création
     */
    protected static function booted()
    {
        static::creating(function ($category) {
            if (empty($category->id)) {
                $category->id = (string) Str::uuid();
            }
        });
    }

    /**
     * Relation avec les plats
     */
    public function plats()
    {
        return $this->hasMany(Plat::class);
    }
}
