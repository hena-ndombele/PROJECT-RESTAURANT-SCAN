<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GroupOrderParticipant extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'group_order_id',
        'name',
        'phone',
        'email',
        'is_creator',
        'is_ready',
        'last_seen_at',
    ];

    protected $casts = [
        'is_creator' => 'boolean',
        'is_ready' => 'boolean',
        'last_seen_at' => 'datetime',
    ];

    public function groupOrder()
    {
        return $this->belongsTo(GroupOrder::class);
    }

    public function items()
    {
        return $this->hasMany(GroupOrderItem::class);
    }
}
