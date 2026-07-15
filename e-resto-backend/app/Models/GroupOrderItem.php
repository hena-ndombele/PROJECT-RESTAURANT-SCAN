<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GroupOrderItem extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'group_order_id',
        'group_order_participant_id',
        'plat_id',
        'quantity',
        'price_at_add',
        'note',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'price_at_add' => 'decimal:2',
    ];

    public function groupOrder()
    {
        return $this->belongsTo(GroupOrder::class);
    }

    public function participant()
    {
        return $this->belongsTo(GroupOrderParticipant::class, 'group_order_participant_id');
    }

    public function plat()
    {
        return $this->belongsTo(Plat::class);
    }
}
