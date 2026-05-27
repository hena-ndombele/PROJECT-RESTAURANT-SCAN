<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory; // <--- NE PAS OUBLIER
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class AccountRequest extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['username', 'phone', 'message', 'status'];

    /**
     * Indique si l'ID est auto-incrémenté.
     *
     * @var bool
     */
    public $incrementing = false;

    /**
     * Le type de la clé primaire.
     *
     * @var string
     */
    protected $keyType = 'string'; // <--- AJOUT CONSEILLÉ
}
