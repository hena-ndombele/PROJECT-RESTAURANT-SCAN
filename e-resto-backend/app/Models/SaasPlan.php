<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SaasPlan extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'monthly_price',
        'currency',
        'max_restaurants',
        'max_tables',
        'max_users',
        'features',
        'is_popular',
        'is_active',
    ];

    protected $casts = [
        'features' => 'array',
        'monthly_price' => 'decimal:2',
        'is_popular' => 'boolean',
        'is_active' => 'boolean',
    ];

    protected $appends = [
        'max_dishes',
        'max_orders_per_month',
    ];

    public function restaurants()
    {
        return $this->hasMany(Restaurant::class, 'saas_plan_id');
    }

    public function tier(): string
    {
        $slug = strtolower((string) $this->slug);
        $name = strtolower((string) $this->name);

        if (str_contains($slug, 'business') || str_contains($name, 'business')) {
            return 'business';
        }

        if (str_contains($slug, 'pro') || str_contains($name, 'pro')) {
            return 'pro';
        }

        return 'starter';
    }

    public function allows(string $feature): bool
    {
        return (bool) ($this->featurePermissions()[$feature] ?? false);
    }

    public function maxDishes(): ?int
    {
        return $this->tier() === 'starter' ? 20 : null;
    }

    public function maxOrdersPerMonth(): ?int
    {
        return $this->tier() === 'starter' ? 150 : null;
    }

    public function maxTables(): ?int
    {
        return in_array($this->tier(), ['pro', 'business'], true) ? null : $this->max_tables;
    }

    public function maxUsers(): ?int
    {
        return in_array($this->tier(), ['pro', 'business'], true) ? null : $this->max_users;
    }

    public function getMaxDishesAttribute(): ?int
    {
        return $this->maxDishes();
    }

    public function getMaxOrdersPerMonthAttribute(): ?int
    {
        return $this->maxOrdersPerMonth();
    }

    public function includedPaymentMethods(): array
    {
        return ['cash'];
    }

    public function featurePermissions(): array
    {
        $tier = $this->tier();

        return [
            'basic_menu' => true,
            'orders' => true,
            'takeaway' => true,
            'mobile_money' => false,
            'analytics' => in_array($tier, ['pro', 'business'], true),
            'advanced_analytics' => $tier === 'business',
            'customization' => in_array($tier, ['pro', 'business'], true),
            'feedback' => in_array($tier, ['pro', 'business'], true),
            'Réservations' => in_array($tier, ['pro', 'business'], true),
            'chatbot' => false,
            'roles' => true,
            'multi_restaurant' => $tier === 'business',
            'priority_support' => in_array($tier, ['pro', 'business'], true),
            'dedicated_support' => $tier === 'business',
        ];
    }
}
