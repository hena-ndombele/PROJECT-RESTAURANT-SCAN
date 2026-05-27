<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids; // Si tu utilises les UUID

class Order extends Model
{
    use HasUuids;

    protected $fillable = ['table_id', 'total_amount', 'currency', 'status', 'note'];

    /**
     * AJOUTE CETTE FONCTION ICI 👇
     * Une commande possède plusieurs lignes (items)
     */
    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Une commande appartient à une table
     */
    public function table()
    {
        return $this->belongsTo(Table::class);
    }
}
