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
        'price_at_order',
        'original_price',
        'original_currency',
        'converted_price',
        'conversion_rate',
    ];

    protected $casts = [
        'price_at_order' => 'decimal:2',
        'original_price' => 'decimal:2',
        'converted_price' => 'decimal:2',
        'conversion_rate' => 'decimal:6',
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
