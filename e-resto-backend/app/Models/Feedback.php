<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Feedback extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'feedbacks';

    protected $fillable = [
        'restaurant_id',
        'order_id',
        'table_id',
        'food_rating',
        'service_rating',
        'ordering_rating',
        'recommended',
        'comment',
        'customer_name',
        'customer_phone',
        'status',
    ];

    protected $casts = [
        'food_rating' => 'integer',
        'service_rating' => 'integer',
        'ordering_rating' => 'integer',
        'recommended' => 'boolean',
    ];

    public function restaurant()
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function table()
    {
        return $this->belongsTo(Table::class);
    }
}
