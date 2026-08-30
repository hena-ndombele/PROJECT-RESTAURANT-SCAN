<?php

namespace App\Services;

use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Encoder\Encoder;
use App\Models\Order;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ReceiptPdfService
{
    public function storeForOrder(Order $order): array
    {
        $order->loadMissing(['restaurant', 'table', 'items.plat', 'latestPayment']);

        $filename = 'receipt-' . Str::upper(substr((string) $order->id, 0, 8)) . '.pdf';
        $path = 'receipts/' . $order->restaurant_id . '/' . $filename;

        Storage::disk('public')->put($path, $this->makePdf($order));

        return [
            'filename' => $filename,
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
        ];
    }

    private function makePdf(Order $order): string
    {
        $restaurantName = $order->restaurant?->name ?? 'Restaurant Scan';
        $receiptNumber = 'ER-' . Str::upper(substr((string) $order->id, 0, 8));
        $placedAt = $this->orderPlacedAt($order);
        $currency = $order->currency ?? $order->restaurant?->currency ?? 'CDF';
        $primary = $this->themeColor($order, 'primary', '#f97316');
        $logo = $this->logoImage($order);
        $tableLabel = $this->tableLabel($order);
        $restaurantUrl = $this->restaurantMenuUrl($order);

        $content = '';
        $content .= $this->rect(0, 760, 595, 82, '#111827');
        $content .= $this->rect(38, 712, 519, 72, '#ffffff', '#e5e7eb');
        $content .= $this->rect(38, 712, 7, 72, $primary);

        if ($logo) {
            $content .= "q\n64 0 0 64 58 721 cm\n/ImLogo Do\nQ\n";
        } else {
            $content .= $this->rect(58, 721, 64, 64, '#ffffff', '#d1d5db');
            $content .= $this->text(80, 746, 20, Str::upper(Str::substr($restaurantName, 0, 1)), 'F2', '#111827');
        }

        $content .= $this->text(138, 753, 22, $restaurantName, 'F2', '#111827');
        $content .= $this->text(138, 733, 10, 'Reçu de paiement confirmé', 'F1', '#6b7280');
        $content .= $this->text(438, 754, 9, 'Numero', 'F1', '#6b7280');
        $content .= $this->text(438, 735, 15, $receiptNumber, 'F2', '#111827');

        $content .= $this->text(52, 678, 10, 'Code de suivi', 'F1', '#6b7280');
        $content .= $this->text(52, 656, 18, $order->tracking_code ?? '-', 'F2', '#111827');
        $content .= $this->text(224, 678, 10, 'Table', 'F1', '#6b7280');
        $content .= $this->text(224, 657, 14, $tableLabel, 'F2', '#111827');
        $content .= $this->text(378, 678, 10, 'Date', 'F1', '#6b7280');
        $content .= $this->text(378, 657, 14, $placedAt, 'F2', '#111827');

        $content .= $this->rect(38, 612, 519, 30, '#111827');
        $content .= $this->text(54, 622, 10, 'ARTICLE', 'F2', '#ffffff');
        $content .= $this->text(344, 622, 10, 'QTE', 'F2', '#ffffff');
        $content .= $this->text(402, 622, 10, 'PRIX', 'F2', '#ffffff');
        $content .= $this->text(496, 622, 10, 'TOTAL', 'F2', '#ffffff');

        $y = 588;
        foreach ($order->items as $item) {
            if ($y < 210) {
                break;
            }

            $name = $this->truncate($item->plat?->name ?? 'Plat', 38);
            $quantity = (int) ($item->quantity ?? 1);
            $price = (float) ($item->price_at_order ?? $item->plat?->price ?? 0);
            $lineTotal = $quantity * $price;

            $content .= $this->line(38, $y + 17, 557, $y + 17, '#e5e7eb');
            $content .= $this->text(54, $y, 11, $name, 'F2', '#111827');
            $content .= $this->text(347, $y, 11, (string) $quantity, 'F1', '#374151');
            $content .= $this->text(402, $y, 11, $this->money($price, $currency), 'F1', '#374151');
            $content .= $this->text(488, $y, 11, $this->money($lineTotal, $currency), 'F2', '#111827');
            $y -= 28;
        }

        $content .= $this->rect(334, $y - 54, 223, 50, '#fff7ed', '#fed7aa');
        $content .= $this->text(352, $y - 25, 11, 'Total payé', 'F1', '#9a3412');
        $content .= $this->text(442, $y - 27, 18, $this->money((float) $order->total_amount, $currency), 'F2', '#111827');

        if ($order->note) {
            $content .= $this->rect(38, $y - 116, 519, 42, '#f9fafb', '#e5e7eb');
            $content .= $this->text(54, $y - 94, 10, 'Note client : ' . $this->truncate($order->note, 82), 'F1', '#374151');
        }

        $content .= $this->line(38, 118, 557, 118, '#e5e7eb');
        $content .= $this->drawQrCode($restaurantUrl, 456, 36, 74);
        $content .= $this->text(52, 74, 11, 'Merci pour votre visite chez ' . $restaurantName . '.', 'F2', '#111827');
        $content .= $this->text(52, 54, 9, 'Reçu généré automatiquement par Restaurant Scan.', 'F1', '#6b7280');

        return $this->buildPdf($content, $logo);
    }

    private function restaurantMenuUrl(Order $order): string
    {
        $baseUrl = rtrim(env('CLIENT_FRONTEND_URL', config('app.url')), '/');
        $params = [
            'restaurant_slug' => $order->restaurant?->slug,
        ];

        return $baseUrl . '/?' . http_build_query(array_filter($params));
    }

    private function drawQrCode(string $value, float $x, float $y, float $size): string
    {
        try {
            $qrCode = Encoder::encode($value, ErrorCorrectionLevel::M(), 'UTF-8');
            $matrix = $qrCode->getMatrix();
        } catch (\Throwable) {
            return '';
        }

        $matrixSize = $matrix->getWidth();
        $quietZone = 4;
        $moduleSize = $size / ($matrixSize + ($quietZone * 2));
        $content = $this->rect($x - 4, $y - 4, $size + 8, $size + 8, '#ffffff', '#e5e7eb');
        $content .= "0 0 0 rg\n";

        for ($row = 0; $row < $matrixSize; $row++) {
            for ($col = 0; $col < $matrixSize; $col++) {
                if (!$matrix->get($col, $row)) {
                    continue;
                }

                $moduleX = $x + (($col + $quietZone) * $moduleSize);
                $moduleY = $y + $size - (($row + $quietZone + 1) * $moduleSize);
                $content .= "{$moduleX} {$moduleY} {$moduleSize} {$moduleSize} re f\n";
            }
        }

        return $content;
    }

    private function buildPdf(string $content, ?array $logo): string
    {
        $resources = '/Font << /F1 4 0 R /F2 5 0 R >>';
        $objects = [
            "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
            "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
            '',
            "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
            "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
            "6 0 obj\n<< /Length " . strlen($content) . " >>\nstream\n{$content}endstream\nendobj\n",
        ];

        if ($logo) {
            $resources .= ' /XObject << /ImLogo 7 0 R >>';
            $image = $logo['data'];
            $objects[] = "7 0 obj\n<< /Type /XObject /Subtype /Image /Width {$logo['width']} /Height {$logo['height']} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " . strlen($image) . " >>\nstream\n{$image}\nendstream\nendobj\n";
        }

        $objects[2] = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << {$resources} >> /Contents 6 0 R >>\nendobj\n";

        $pdf = "%PDF-1.4\n";
        $offsets = [0];

        foreach ($objects as $object) {
            $offsets[] = strlen($pdf);
            $pdf .= $object;
        }

        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";

        for ($i = 1; $i <= count($objects); $i++) {
            $pdf .= str_pad((string) $offsets[$i], 10, '0', STR_PAD_LEFT) . " 00000 n \n";
        }

        $pdf .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
        $pdf .= "startxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }

    private function logoImage(Order $order): ?array
    {
        $path = public_path('assets/logo.png');

        if ($order->restaurant?->logo && Storage::disk('public')->exists($order->restaurant->logo)) {
            $path = Storage::disk('public')->path($order->restaurant->logo);
        }

        if (!is_file($path)) {
            return null;
        }

        $data = (string) file_get_contents($path);
        $info = @getimagesizefromstring($data);
        $mime = $info['mime'] ?? '';

        if ($mime === 'image/jpeg') {
            return ['data' => $data, 'width' => $info[0], 'height' => $info[1]];
        }

        if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) {
            return null;
        }

        $source = @imagecreatefromstring($data);
        if (!$source) {
            return null;
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $canvas = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefilledrectangle($canvas, 0, 0, $width, $height, $white);
        imagecopy($canvas, $source, 0, 0, 0, 0, $width, $height);

        ob_start();
        imagejpeg($canvas, null, 90);
        $jpeg = (string) ob_get_clean();
        imagedestroy($source);
        imagedestroy($canvas);

        return ['data' => $jpeg, 'width' => $width, 'height' => $height];
    }

    private function text(float $x, float $y, int $size, string $text, string $font = 'F1', string $color = '#111827'): string
    {
        [$r, $g, $b] = $this->rgb($color);

        return "{$r} {$g} {$b} rg\nBT\n/{$font} {$size} Tf\n{$x} {$y} Td\n(" . $this->escapePdfText($text) . ") Tj\nET\n";
    }

    private function rect(float $x, float $y, float $width, float $height, string $fill, ?string $stroke = null): string
    {
        [$r, $g, $b] = $this->rgb($fill);
        $command = "{$r} {$g} {$b} rg\n";

        if ($stroke) {
            [$sr, $sg, $sb] = $this->rgb($stroke);
            $command .= "{$sr} {$sg} {$sb} RG\n{$x} {$y} {$width} {$height} re B\n";
            return $command;
        }

        return $command . "{$x} {$y} {$width} {$height} re f\n";
    }

    private function line(float $x1, float $y1, float $x2, float $y2, string $color): string
    {
        [$r, $g, $b] = $this->rgb($color);

        return "{$r} {$g} {$b} RG\n1 w\n{$x1} {$y1} m\n{$x2} {$y2} l\nS\n";
    }

    private function rgb(string $hex): array
    {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        if (!preg_match('/^[0-9a-fA-F]{6}$/', $hex)) {
            $hex = '111827';
        }

        return [
            round(hexdec(substr($hex, 0, 2)) / 255, 3),
            round(hexdec(substr($hex, 2, 2)) / 255, 3),
            round(hexdec(substr($hex, 4, 2)) / 255, 3),
        ];
    }

    private function themeColor(Order $order, string $key, string $fallback): string
    {
        $settings = $order->restaurant?->settings ?? [];
        if (!is_array($settings)) {
            return $fallback;
        }

        $theme = $settings['theme'] ?? [];
        if (!is_array($theme)) {
            return $fallback;
        }

        return $theme[$key] ?? $fallback;
    }

    private function orderPlacedAt(Order $order): string
    {
        $timezone = $order->restaurant?->settings['timezone']
            ?? config('app.display_timezone', 'Africa/Kinshasa');

        return optional($order->created_at)
            ->copy()
            ->timezone($timezone)
            ->format('d/m/Y H:i') ?: now($timezone)->format('d/m/Y H:i');
    }

    private function money(float $amount, string $currency): string
    {
        return number_format($amount, 2, ',', ' ') . ' ' . $currency;
    }

    private function tableLabel(Order $order): string
    {
        $tableName = trim((string) ($order->table?->name ?? ''));

        if ($order->order_type === 'remote' || strcasecmp($tableName, 'Commandes en ligne') === 0) {
            return 'WhatsApp';
        }

        return $tableName !== '' ? $tableName : 'N/A';
    }

    private function truncate(string $text, int $length): string
    {
        $text = trim(preg_replace('/\s+/', ' ', $text) ?? '');

        return Str::length($text) > $length ? Str::substr($text, 0, $length - 3) . '...' : $text;
    }

    private function escapePdfText(string $text): string
    {
        $text = Str::ascii($text);

        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
    }
}
