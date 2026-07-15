<?php

namespace App\Services;

use App\Mail\OrderFollowupMail;
use App\Models\Order;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class OrderEmailFollowupService
{
    public function __construct(private readonly ReceiptPdfService $receiptPdf)
    {
    }

    public function sendForPaidOrder(Order $order): void
    {
        $order->loadMissing(['restaurant', 'table', 'items.plat', 'latestPayment']);

        if ($order->payment_status !== 'paid' || !$order->latestPayment) {
            return;
        }

        $payment = $order->latestPayment;
        $metadata = $payment->metadata ?? [];

        if (($metadata['email_followup_sent'] ?? false) === true) {
            return;
        }

        $recipients = $this->recipients($order, $metadata);
        if (empty($recipients)) {
            $this->mark($payment, ['email_followup_error' => 'missing_customer_email']);
            return;
        }

        try {
            $receipt = null;
            if (collect($recipients)->contains(fn ($recipient) => $recipient['receipt'])) {
                $receipt = $this->receiptPdf->storeForOrder($order);
            }

            $results = [];
            foreach ($recipients as $recipient) {
                $feedbackUrl = $recipient['feedback'] ? $this->trackingUrl($order) : null;

                Mail::to($recipient['email'])->send(new OrderFollowupMail($order, [
                    'receipt' => (bool) $recipient['receipt'],
                    'feedback' => (bool) $recipient['feedback'],
                ], $recipient['receipt'] ? $receipt : null, $feedbackUrl));

                $results[] = [
                    'email' => $recipient['email'],
                    'receipt' => (bool) $recipient['receipt'],
                    'feedback' => (bool) $recipient['feedback'],
                ];
            }

            $this->mark($payment, [
                'email_followup_sent' => true,
                'email_followup_sent_at' => now()->toIso8601String(),
                'email_followup_recipients' => $results,
                'email_followup_error' => null,
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Order email follow-up failed', [
                'order_id' => $order->id,
                'message' => $exception->getMessage(),
            ]);

            $this->mark($payment, ['email_followup_error' => $exception->getMessage()]);
        }
    }

    private function recipients(Order $order, array $metadata): array
    {
        $recipients = [];

        if (($metadata['email_followup_enabled'] ?? false) && ($metadata['email_contact'] ?? $order->customer_email)) {
            $recipients[] = [
                'email' => $metadata['email_contact'] ?? $order->customer_email,
                'receipt' => (bool) ($metadata['email_receipt_requested'] ?? false),
                'feedback' => (bool) ($metadata['email_feedback_requested'] ?? false),
            ];
        }

        foreach (($metadata['group_participant_email_followups'] ?? []) as $participant) {
            if (empty($participant['email'])) {
                continue;
            }

            $recipients[] = [
                'email' => $participant['email'],
                'receipt' => (bool) ($participant['receipt'] ?? false),
                'feedback' => (bool) ($participant['feedback'] ?? false),
            ];
        }

        return collect($recipients)
            ->filter(fn ($recipient) => $recipient['email'] && ($recipient['receipt'] || $recipient['feedback']))
            ->unique(fn ($recipient) => strtolower($recipient['email']) . ':' . (int) $recipient['receipt'] . ':' . (int) $recipient['feedback'])
            ->values()
            ->all();
    }

    private function trackingUrl(Order $order): string
    {
        $baseUrl = rtrim(env('CLIENT_FRONTEND_URL', env('FRONT_CLIENT_URL', config('app.url'))), '/');
        $tableName = trim((string) ($order->table?->name ?? ''));
        $tableId = ($order->order_type === 'remote' || strcasecmp($tableName, 'Commandes hors restaurant') === 0)
            ? null
            : $order->table_id;
        $query = array_filter([
            'table_id' => $tableId,
            'restaurant_slug' => $order->restaurant?->slug,
            'order_id' => $order->id,
            'tracking_code' => $order->tracking_code,
            'feedback' => 1,
            'menu' => 1,
        ]);

        return $baseUrl . '/?' . http_build_query($query);
    }

    private function mark($payment, array $metadata): void
    {
        $payment->forceFill([
            'metadata' => array_replace_recursive($payment->metadata ?? [], $metadata),
        ])->save();
    }
}
