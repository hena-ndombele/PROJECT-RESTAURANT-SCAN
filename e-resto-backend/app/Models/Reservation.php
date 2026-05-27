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
        'table_id',
        'name',
        'phone',
        'email',
        'guests',
        'reservation_date',
        'reservation_time',
        'special_requests',
        'status',
    ];

    protected $casts = [
        'reservation_date' => 'date',
        'guests' => 'integer',
    ];

    protected $keyType = 'string';
    public $incrementing = false;

    public function table()
    {
        return $this->belongsTo(Table::class);
    }
}
