<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class NewsletterCampaignDelivery extends Model
{
    use HasUuids;

    protected $fillable = ['campaign_id', 'subscriber_id', 'email', 'status', 'sent_at', 'error_message'];
    protected $casts = ['sent_at' => 'datetime'];
    protected $keyType = 'string';
    public $incrementing = false;

    public function campaign() { return $this->belongsTo(NewsletterCampaign::class, 'campaign_id'); }
    public function subscriber() { return $this->belongsTo(NewsletterSubscriber::class, 'subscriber_id'); }
}
