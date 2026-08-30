<?php

namespace App\Console\Commands;

use App\Http\Controllers\Saas\NewsletterController;
use Illuminate\Console\Command;

class DispatchScheduledNewsletterCampaigns extends Command
{
    protected $signature = 'newsletter:dispatch-scheduled';
    protected $description = 'Place les campagnes newsletter programmées dans la file d’envoi';

    public function handle(NewsletterController $controller): int
    {
        $count = $controller->dispatchDueCampaigns();
        $this->info("{$count} campagne(s) programmée(s) placée(s) dans la file.");
        return self::SUCCESS;
    }
}
