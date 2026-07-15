<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GroupOrder extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'restaurant_id',
        'table_id',
        'order_id',
        'code',
        'status',
        'creator_name',
        'creator_phone',
        'creator_email',
        'creator_code_hash',
        'note',
        'expires_at',
        'checked_out_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'checked_out_at' => 'datetime',
    ];

    public function restaurant()
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function table()
    {
        return $this->belongsTo(Table::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function participants()
    {
        return $this->hasMany(GroupOrderParticipant::class);
    }

    public function items()
    {
        return $this->hasMany(GroupOrderItem::class);
    }
}
