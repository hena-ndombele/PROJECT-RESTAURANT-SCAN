<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids; // Importation du trait

class OrderItem extends Model
{
    use HasUuids; // Indispensable pour générer l'ID de la ligne en UUID

    protected $fillable = [
        'order_id',
        'plat_id',
        'quantity', 
        'price_at_order'
    ];

    /**
     * Relation vers la commande parente
     */
    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Relation vers le plat commandé
     */
    public function plat()
    {
        return $this->belongsTo(Plat::class);
    }
}
