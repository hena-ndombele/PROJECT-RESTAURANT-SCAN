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
        'yearly_price',
        'promo_label',
        'promo_percent',
        'promo_starts_at',
        'promo_ends_at',
        'currency',
        'max_restaurants',
        'max_tables',
        'max_users',
        'max_dishes',
        'max_orders_per_month',
        'features',
        'is_popular',
        'is_active',
    ];

    protected $casts = [
        'features' => 'array',
        'monthly_price' => 'decimal:2',
        'yearly_price' => 'decimal:2',
        'promo_percent' => 'integer',
        'promo_starts_at' => 'date',
        'promo_ends_at' => 'date',
        'max_dishes' => 'integer',
        'max_orders_per_month' => 'integer',
        'is_popular' => 'boolean',
        'is_active' => 'boolean',
    ];

    protected $appends = [
        'max_dishes',
        'max_orders_per_month',
        'has_active_promo',
        'promo_monthly_price',
        'promo_yearly_price',
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
        if (array_key_exists('max_dishes', $this->attributes) && $this->attributes['max_dishes'] !== null) {
            return (int) $this->attributes['max_dishes'];
        }

        return $this->tier() === 'starter' ? 15 : null;
    }

    public function maxOrdersPerMonth(): ?int
    {
        if (array_key_exists('max_orders_per_month', $this->attributes) && $this->attributes['max_orders_per_month'] !== null) {
            return (int) $this->attributes['max_orders_per_month'];
        }

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

    public function hasActivePromo(): bool
    {
        $percent = (int) ($this->promo_percent ?? 0);

        return $percent > 0
            && $percent < 100
            && (!$this->promo_starts_at || $this->promo_starts_at->startOfDay()->isPast())
            && (!$this->promo_ends_at || $this->promo_ends_at->endOfDay()->isFuture());
    }

    public function priceForCycle(string $billingCycle = 'monthly'): float
    {
        $base = $billingCycle === 'yearly'
            ? (float) ($this->yearly_price ?: ((float) $this->monthly_price * 12))
            : (float) $this->monthly_price;

        if (!$this->hasActivePromo()) {
            return $base;
        }

        return round($base * (1 - ((int) $this->promo_percent / 100)), 2);
    }

    public function getHasActivePromoAttribute(): bool
    {
        return $this->hasActivePromo();
    }

    public function getPromoMonthlyPriceAttribute(): ?float
    {
        return $this->hasActivePromo() ? $this->priceForCycle('monthly') : null;
    }

    public function getPromoYearlyPriceAttribute(): ?float
    {
        return $this->hasActivePromo() ? $this->priceForCycle('yearly') : null;
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
            'reservations' => in_array($tier, ['pro', 'business'], true),
            'chatbot' => $tier === 'business',
            'roles' => true,
            'multi_restaurant' => $tier === 'business',
            'dish_promotions' => true,
            'priority_support' => in_array($tier, ['pro', 'business'], true),
            'dedicated_support' => $tier === 'business',
        ];
    }

    private function featureIsListed(string $label): bool
    {
        $needle = $this->normalizeFeatureName($label);

        foreach (($this->features ?? []) as $feature) {
            if ($this->normalizeFeatureName((string) $feature) === $needle) {
                return true;
            }
        }

        return false;
    }

    private function normalizeFeatureName(string $value): string
    {
        return strtolower(trim(str_replace(['_', '-'], ' ', $value)));
    }
}
