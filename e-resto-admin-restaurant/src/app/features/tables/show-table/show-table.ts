import { Component, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { TableDto } from "../../../models/table/TableDto";
import { API_ROOT, STORAGE_ROOT } from "../../../services/api-url";

@Component({
    selector: "app-show-table",
    imports: [],
    templateUrl: "./show-table.html",
    styleUrl: "./show-table.scss",
    standalone: true
})
export class ShowTable implements OnInit, OnChanges {
    @Input() table: TableDto | undefined;
    @Input() tableId: string | null = null;
    tableDetail?: TableDto;
    private readonly defaultLogo = "assets/logo/e-resto-logo.png";

    ngOnInit(): void {
        this.syncTableDetail();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes["table"]) {
            this.syncTableDetail();
        }
    }

    private syncTableDetail(): void {
        if (this.table) {
            this.tableDetail = this.table;
        }
    }

    restaurantLogo(): string {
        const cached = localStorage.getItem("restaurant_session");
        if (!cached) return this.defaultLogo;

        try {
            const restaurant = JSON.parse(cached);
            return restaurant.logo_data_url || restaurant.logo_url || (restaurant.logo ? `${STORAGE_ROOT}/${restaurant.logo}` : this.defaultLogo);
        } catch {
            return this.defaultLogo;
        }
    }

    restaurantName(): string {
        const cached = localStorage.getItem("restaurant_session");
        if (!cached) return "Restaurant Scan";

        try {
            return JSON.parse(cached).name || "Restaurant Scan";
        } catch {
            return "Restaurant Scan";
        }
    }

    tableQrUrl(table: TableDto): string | null {
        if (!table.qr_url) return null;

        const apiBase = API_ROOT.replace(/\/api$/, "");
        const apiQrUrl = (pathname: string) => {
            const filename = pathname.split("/").pop();
            return filename ? `${apiBase}/api/table-qrcodes/${filename}` : null;
        };

        try {
            const url = new URL(table.qr_url);
            if (url.pathname.includes("/storage/qrcodes/")) {
                return apiQrUrl(url.pathname);
            }
        } catch {
            if (table.qr_url.startsWith("/storage/qrcodes/")) {
                return apiQrUrl(table.qr_url);
            }
        }

        return table.qr_url;
    }
    primaryColor(): string {
        return getComputedStyle(document.documentElement).getPropertyValue("--dashboard-primary").trim() || "#ff7a1a";
    }

    async printQRCode(): Promise<void> {
        if (!this.tableDetail?.qr_url) return;

        if (this.canUsePremiumQrTemplates()) {
            void this.printTemplateQRCode();
            return;
        }

        const canvas = await this.buildDefaultQrCanvas();
        if (!canvas || !this.tableDetail) return;

        this.printCanvasQRCode(canvas, this.tableDetail.name);
    }

    async downloadQRCode(): Promise<void> {
        if (!this.tableDetail?.qr_url) return;

        if (this.canUsePremiumQrTemplates()) {
            const canvas = await this.buildPremiumQrCanvas();
            if (!canvas) return;
            const link = document.createElement("a");
            link.download = `qr-table-${this.slugify(this.tableDetail.name)}-${this.selectedQrTemplate()}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            return;
        }

        const canvas = await this.buildDefaultQrCanvas();
        if (!canvas) return;

        const link = document.createElement("a");
        link.download = `qr-table-${this.slugify(this.tableDetail.name)}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }

    private async buildDefaultQrCanvas(): Promise<HTMLCanvasElement | null> {
        if (!this.tableDetail?.qr_url) return null;

        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 1200;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        const primary = this.primaryColor();
        const logo = await this.loadRestaurantLogoImage();
        const qrUrl = this.tableQrUrl(this.tableDetail);
        if (!qrUrl) return null;
        const qr = await this.loadImage(qrUrl);
        const tableName = this.tableDetail.name;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        this.drawOuterFrame(ctx, 88, 48, 724, 1030, 4, primary);
        if (logo) this.drawContainImage(ctx, logo, 300, 82, 300, 130);

        ctx.fillStyle = "#111827";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.font = "900 32px Arial";
        ctx.fillText("SCAN TO ORDER", 450, 292);

        const frameX = 210;
        const frameY = 340;
        const frameSize = 480;
        const qrBoxX = frameX + 40;
        const qrBoxY = frameY + 40;
        const qrBoxSize = 400;

        ctx.strokeStyle = "rgba(15, 23, 42, .28)";
        ctx.lineWidth = 2;
        ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
        if (qr) ctx.drawImage(qr, qrBoxX + 28, qrBoxY + 28, qrBoxSize - 56, qrBoxSize - 56);

        if (logo) {
            ctx.fillStyle = "#ffffff";
            this.roundRect(ctx, 393, 533, 114, 84, 14);
            ctx.fill();
            ctx.strokeStyle = "rgba(15, 23, 42, .14)";
            ctx.lineWidth = 3;
            this.roundRect(ctx, 393, 533, 114, 84, 14);
            ctx.stroke();
            this.drawContainImage(ctx, logo, 408, 548, 84, 54);
        }

        this.drawCorner(ctx, frameX, frameY, "tl", primary);
        this.drawCorner(ctx, frameX + frameSize, frameY, "tr", primary);
        this.drawCorner(ctx, frameX, frameY + frameSize, "bl", primary);
        this.drawCorner(ctx, frameX + frameSize, frameY + frameSize, "br", primary);

        ctx.fillStyle = "#111827";
        ctx.fillRect(150, 875, 600, 72);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.font = "900 44px Arial";
        ctx.fillText(this.truncateText(ctx, tableName.toUpperCase(), 540), 450, 926);

        return canvas;
    }

    private async printTemplateQRCode(): Promise<void> {
        const canvas = await this.buildPremiumQrCanvas();
        if (!canvas || !this.tableDetail) return;

        this.printCanvasQRCode(canvas, this.tableDetail.name);
    }

    private printCanvasQRCode(canvas: HTMLCanvasElement, tableName: string): void {
        const imageUrl = canvas.toDataURL("image/png");
        const printWindow = window.open("", "", "left=0,top=0,width=980,height=1200");
        if (!printWindow) return;

        printWindow.document.write(`
<html>
<head>
  <title>QR Code - ${this.escapeHtml(tableName)}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; display: grid; place-items: center; background: #fff; overflow: hidden; }
    img { max-width: calc(100vw - 12mm); max-height: calc(100vh - 12mm); width: auto; height: auto; display: block; object-fit: contain; }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="QR Code ${this.escapeHtml(tableName)}">
  <script>window.onload = function(){ setTimeout(function(){ window.print(); window.close(); }, 400); };</script>
</body>
</html>`);
        printWindow.document.close();
    }

    private async buildPremiumQrCanvas(): Promise<HTMLCanvasElement | null> {
        if (!this.tableDetail?.qr_url) return null;

        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 1273;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        const logo = await this.loadRestaurantLogoImage();
        const qrUrl = this.tableQrUrl(this.tableDetail);
        if (!qrUrl) return null;
        const qr = await this.loadImage(qrUrl);
        if (!qr) return null;
        const [burgerImage, wrapImage, promoImage] = await Promise.all([
            this.loadImage("assets/images/humb.jpg"),
            this.loadImage("assets/images/cha.jpg"),
            this.loadImage("assets/images/cha2.jpg"),
        ]);
        const foodAssets = { burgerImage, shawarmaImage: wrapImage, promoImage };

        const info = this.restaurantPrintInfo();
        if (this.selectedQrTemplate() === "table_tent") {
            this.drawTableTentTemplate(ctx, qr, logo, info, foodAssets);
        } else {
            this.drawPosterTemplate(ctx, qr, logo, info, foodAssets);
        }

        return canvas;
    }

    private drawPosterTemplate(ctx: CanvasRenderingContext2D, qr: HTMLImageElement, logo: HTMLImageElement | null, info: any, foodAssets: any): void {
        const accent = info.primary || "#ff7a1a";
        const cardX = 58;
        const cardY = 44;
        const cardW = 784;
        const cardH = 1185;
        const innerX = 82;
        const innerY = 72;
        const innerW = 736;
        const innerH = 1128;

        ctx.fillStyle = "#eef2f7";
        ctx.fillRect(0, 0, 900, 1273);

        ctx.save();
        ctx.shadowColor = "rgba(15, 23, 42, .18)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = "#cbd5e1";
        this.roundRect(ctx, cardX, cardY, cardW, cardH, 14);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "#ffffff";
        this.roundRect(ctx, innerX, innerY, innerW, innerH, 8);
        ctx.fill();

        ctx.save();
        this.roundRect(ctx, innerX, innerY, innerW, innerH, 8);
        ctx.clip();

        if (foodAssets?.burgerImage) {
            this.drawCoverImage(ctx, foodAssets.burgerImage, innerX, innerY, innerW, 770);
        } else {
            ctx.fillStyle = accent;
            ctx.fillRect(innerX, innerY, innerW, 770);
        }
        ctx.fillStyle = "rgba(0, 0, 0, .58)";
        ctx.fillRect(innerX, innerY, innerW, 770);

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(innerX, 700);
        ctx.quadraticCurveTo(265, 760, 450, 725);
        ctx.quadraticCurveTo(645, 690, innerX + innerW, 720);
        ctx.lineTo(innerX + innerW, innerY + innerH);
        ctx.lineTo(innerX, innerY + innerH);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        if (logo) {
            this.drawContainImage(ctx, logo, 300, 115, 300, 130);
        }

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.font = "900 48px Arial";
        ctx.fillText("SCAN TO ORDER", 450, 330);

        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, .22)";
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = "#ffffff";
        this.roundRect(ctx, 160, 390, 580, 580, 42);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = accent;
        ctx.lineWidth = 6;
        this.roundRect(ctx, 160, 390, 580, 580, 42);
        ctx.stroke();
        ctx.drawImage(qr, 205, 435, 490, 490);

        if (logo) {
            ctx.fillStyle = "#ffffff";
            this.roundRect(ctx, 393, 638, 114, 84, 14);
            ctx.fill();
            ctx.strokeStyle = "rgba(15, 23, 42, .14)";
            ctx.lineWidth = 3;
            this.roundRect(ctx, 393, 638, 114, 84, 14);
            ctx.stroke();
            this.drawContainImage(ctx, logo, 408, 653, 84, 54);
        }

        ctx.fillStyle = "#111827";
        ctx.fillRect(150, 1025, 600, 72);
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 42px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.truncateText(ctx, info.tableName.toUpperCase(), 540), 450, 1076);
        ctx.save();
        ctx.fillStyle = "#f8fafc";
        this.roundRect(ctx, 255, 1120, 390, 58, 29);
        ctx.fill();
        ctx.strokeStyle = "rgba(17, 24, 39, .14)";
        ctx.lineWidth = 2;
        this.roundRect(ctx, 255, 1120, 390, 58, 29);
        ctx.stroke();
        this.drawPhoneIcon(ctx, 292, 1135, "#111827");
        ctx.fillStyle = "#111827";
        ctx.font = "800 24px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(this.truncateText(ctx, info.phone, 290), 350, 1158);
        ctx.restore();
    }
    private drawTableTentTemplate(ctx: CanvasRenderingContext2D, qr: HTMLImageElement, logo: HTMLImageElement | null, info: any, foodAssets: any): void {
        const red = "#9f3b2b";
        const yellow = "#ffd51f";

        if (foodAssets?.shawarmaImage) {
            this.drawCoverImage(ctx, foodAssets.shawarmaImage, 0, 0, 900, 1273);
        } else {
            ctx.fillStyle = "#28351f";
            ctx.fillRect(0, 0, 900, 1273);
        }

        ctx.fillStyle = "rgba(0, 0, 0, .52)";
        ctx.fillRect(0, 0, 900, 1273);
        ctx.fillStyle = "rgba(38, 51, 28, .28)";
        ctx.fillRect(0, 0, 900, 1273);

        if (logo) {
            this.drawContainImage(ctx, logo, 374, 28, 152, 112);
        }

        ctx.fillStyle = yellow;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.font = "900 46px Arial";
        ctx.fillText("SCAN TO ORDER", 450, 330);

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,.28)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "rgba(255,255,255,.94)";
        this.roundRect(ctx, 160, 410, 580, 580, 62);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 7;
        this.roundRect(ctx, 140, 390, 620, 620, 72);
        ctx.stroke();
        ctx.drawImage(qr, 205, 455, 490, 490);

        if (logo) {
            this.drawContainImage(ctx, logo, 408, 675, 84, 54);
        }

        ctx.save();
        ctx.strokeStyle = yellow;
        ctx.lineWidth = 4;
        this.roundRect(ctx, 210, 1040, 480, 74, 16);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = red;
        ctx.fillRect(0, 1160, 900, 113);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(560, 1185);
        ctx.lineTo(560, 1244);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.font = "700 24px Arial";
        this.wrapText(ctx, info.address || "Adresse du restaurant", 54, 1206, 455, 30);

        this.drawPhoneIcon(ctx, 612, 1202, "#ffffff", 0.48);
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 22px Arial";
        ctx.fillText(this.truncateText(ctx, info.phone, 220), 655, 1226);

        ctx.save();
        const displayTableName = this.truncateText(ctx, String(info.tableName || this.tableDetail?.name || this.table?.name || "TABLE").toUpperCase(), 420);
        ctx.strokeStyle = yellow;
        ctx.lineWidth = 4;
        this.roundRect(ctx, 210, 1040, 480, 74, 16);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 46px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(displayTableName, 450, 1077);
        ctx.restore();
    }
    private restaurantPrintInfo(): any {
        const restaurant = this.restaurantSession();
        return {
            name: this.restaurantName(),
            phone: restaurant?.settings?.whatsapp_order_phone || restaurant?.owner_phone || "+243",
            slogan: restaurant?.settings?.slogan || "Menu digital QR code",
            menuUrl: this.menuUrl(restaurant),
            primary: this.primaryColor(),
            tableName: this.tableDetail?.name || this.table?.name || "TABLE",
            address: [restaurant?.address, restaurant?.city].filter(Boolean).join(", "),
        };
    }

    private selectedQrTemplate(): "poster" | "table_tent" {
        const template = this.restaurantSession()?.settings?.qr_template;
        return template === "table_tent" ? "table_tent" : "poster";
    }

    private canUsePremiumQrTemplates(): boolean {
        const restaurant = this.restaurantSession();
        const template = restaurant?.settings?.qr_template;
        const hasSelectedTemplate = template === "poster" || template === "table_tent";
        const slug = String(restaurant?.plan?.slug || restaurant?.plan?.name || "").toLowerCase();
        const canCustomize = Boolean(restaurant?.features?.customization) || slug.includes("pro") || slug.includes("business");

        return canCustomize && hasSelectedTemplate;
    }

    private restaurantSession(): any {
        const cached = localStorage.getItem("restaurant_session");
        if (!cached) return null;
        try {
            return JSON.parse(cached);
        } catch {
            return null;
        }
    }

    private menuUrl(restaurant: any): string {
        const slug = restaurant?.slug || "mon-restaurant";
        const base = window.location.origin.replace(":4200", ":5173");
        return `${base}/?restaurant_slug=${slug}`;
    }

    private loadImage(src: string): Promise<HTMLImageElement | null> {
        return new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = src;
        });
    }

    private async loadRestaurantLogoImage(): Promise<HTMLImageElement | null> {
        const logo = await this.loadImage(this.restaurantLogo());
        if (logo) return logo;

        return this.loadImage(this.defaultLogo);
    }

    private drawCoverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
        const imageRatio = image.width / image.height;
        const boxRatio = width / height;
        let sourceWidth = image.width;
        let sourceHeight = image.height;
        let sourceX = 0;
        let sourceY = 0;

        if (imageRatio > boxRatio) {
            sourceWidth = image.height * boxRatio;
            sourceX = (image.width - sourceWidth) / 2;
        } else {
            sourceHeight = image.width / boxRatio;
            sourceY = (image.height - sourceHeight) / 2;
        }

        ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
    }

    private drawContainImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
        const ratio = Math.min(width / image.width, height / image.height);
        const drawWidth = image.width * ratio;
        const drawHeight = image.height * ratio;
        const drawX = x + (width - drawWidth) / 2;
        const drawY = y + (height - drawHeight) / 2;
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    }

    private drawPhoneIcon(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scale = 0.72): void {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(7, 9);
        ctx.quadraticCurveTo(18, 35, 47, 42);
        ctx.lineTo(57, 31);
        ctx.lineTo(43, 20);
        ctx.lineTo(34, 29);
        ctx.quadraticCurveTo(24, 25, 20, 15);
        ctx.lineTo(29, 7);
        ctx.lineTo(18, -4);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
    private drawOuterFrame(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string): void {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        this.roundRect(ctx, x, y, width, height, radius);
        ctx.stroke();
        ctx.restore();
    }

    private colorWithAlpha(color: string, alpha: number): string {
        const hex = color.trim();
        if (/^#[0-9a-f]{3}$/i.test(hex)) {
            const r = parseInt(hex[1] + hex[1], 16);
            const g = parseInt(hex[2] + hex[2], 16);
            const b = parseInt(hex[3] + hex[3], 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        if (/^#[0-9a-f]{6}$/i.test(hex)) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return color;
    }

    private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
    }

    private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
        const words = text.split(" ");
        let line = "";

        for (const word of words) {
            const testLine = line ? `${line} ${word}` : word;
            if (ctx.measureText(testLine).width > maxWidth && line) {
                ctx.fillText(line, x, y);
                line = word;
                y += lineHeight;
            } else {
                line = testLine;
            }
        }

        if (line) {
            ctx.fillText(line, x, y);
        }
    }

    private drawCorner(ctx: CanvasRenderingContext2D, x: number, y: number, corner: "tl" | "tr" | "bl" | "br", color: string): void {
        const size = 74;
        const radius = 22;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 12;
        ctx.lineCap = "round";
        ctx.shadowColor = "rgba(15, 23, 42, .22)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();

        if (corner === "tl") {
            ctx.moveTo(x, y + size);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.lineTo(x + size, y);
        }

        if (corner === "tr") {
            ctx.moveTo(x - size, y);
            ctx.lineTo(x - radius, y);
            ctx.quadraticCurveTo(x, y, x, y + radius);
            ctx.lineTo(x, y + size);
        }

        if (corner === "bl") {
            ctx.moveTo(x, y - size);
            ctx.lineTo(x, y - radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.lineTo(x + size, y);
        }

        if (corner === "br") {
            ctx.moveTo(x - size, y);
            ctx.lineTo(x - radius, y);
            ctx.quadraticCurveTo(x, y, x, y - radius);
            ctx.lineTo(x, y - size);
        }

        ctx.stroke();
        ctx.restore();
    }
    private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
        if (ctx.measureText(text).width <= maxWidth) return text;

        let next = text;
        while (next.length > 3 && ctx.measureText(`${next}...`).width > maxWidth) {
            next = next.slice(0, -1);
        }

        return `${next}...`;
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private slugify(value: string): string {
        return value
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "table";
    }
}
