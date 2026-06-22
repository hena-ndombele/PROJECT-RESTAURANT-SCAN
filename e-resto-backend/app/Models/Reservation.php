<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Reservation extends Model
{
    use HasFactory;
    use HasUuids;

    protected $fillable = [
        'restaurant_id',
        'table_id',
        'name',
        'phone',
        'email',
        'guests',
        'reservation_date',
        'reservation_time',
        'special_requests',
        'internal_note',
        'cancellation_reason',
        'status',
        'source',
        'confirmed_at',
        'seated_at',
        'completed_at',
    ];

    protected $casts = [
        'reservation_date' => 'date',
        'guests' => 'integer',
        'confirmed_at' => 'datetime',
        'seated_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    protected $keyType = 'string';
    public $incrementing = false;

    public function table()
    {
        return $this->belongsTo(Table::class);
    }

    public function restaurant()
    {
        return $this->belongsTo(Restaurant::class);
    }
}
