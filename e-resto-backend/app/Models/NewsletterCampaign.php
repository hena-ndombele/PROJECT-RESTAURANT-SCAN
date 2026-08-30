<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class NewsletterCampaign extends Model
{
    use HasUuids;

    protected $fillable = [
        'title', 'subject', 'content', 'image_path', 'button_text', 'button_url',
        'status', 'scheduled_at', 'started_at', 'sent_at', 'recipient_total',
        'sent_count', 'failed_count', 'created_by',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime', 'started_at' => 'datetime', 'sent_at' => 'datetime',
    ];

    protected $appends = ['image_url'];
    protected $keyType = 'string';
    public $incrementing = false;

    public function deliveries()
    {
        return $this->hasMany(NewsletterCampaignDelivery::class, 'campaign_id');
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? asset('storage/'.$this->image_path) : null;
    }
}
