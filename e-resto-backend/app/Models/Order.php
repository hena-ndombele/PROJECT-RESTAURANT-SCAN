<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids; // Si tu utilises les UUID

class Order extends Model
{
    use HasUuids;

    protected $fillable = [
        'restaurant_id',
        'tracking_code',
        'table_id',
        'order_type',
        'total_amount',
        'currency',
        'payment_method',
        'payment_provider',
        'payment_status',
        'status',
        'note',
        'customer_name',
        'customer_phone',
        'customer_email',
        'pickup_name',
        'pickup_phone',
        'cancellation_reason',
        'cancelled_by',
        'cancelled_at',
    ];

    protected $casts = [
        'cancelled_at' => 'datetime',
    ];

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

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function latestPayment()
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }
}
