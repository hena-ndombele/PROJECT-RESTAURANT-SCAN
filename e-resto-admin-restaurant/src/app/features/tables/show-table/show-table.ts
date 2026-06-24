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
        if (!cached) return "assets/logo/e-resto-logo.png";

        try {
            const restaurant = JSON.parse(cached);
            return restaurant.logo_url || (restaurant.logo ? `${STORAGE_ROOT}/${restaurant.logo}` : "assets/logo/e-resto-logo.png");
        } catch {
            return "assets/logo/e-resto-logo.png";
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

    printQRCode(): void {
        if (!this.tableDetail?.qr_url) return;

        if (this.canUsePremiumQrTemplates()) {
            void this.printTemplateQRCode();
            return;
        }

        const logoUrl = this.restaurantLogo();
        const primary = this.primaryColor();
        const restaurantName = this.restaurantName();
        const tableName = this.tableDetail.name;
        const qrUrl = this.tableQrUrl(this.tableDetail);
        const windowPrint = window.open("", "", "left=0,top=0,width=760,height=980");

        if (!windowPrint) return;

        windowPrint.document.write(`
<html>
<head>
  <title>QR Code - ${this.escapeHtml(tableName)}</title>
  <style>
    @page { size: portrait; margin: 8mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
    }
    .scan-card {
      width: 520px;
      min-height: 740px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 34px 34px 28px;
      background: #ffffff !important;
      color: #111827 !important;
    }
    .brand {
      width: 170px;
      height: 122px;
      display: grid;
      place-items: center;
      margin-bottom: 24px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent !important;
      overflow: visible;
    }
    .brand img,
    .qr-logo img {
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    h1 {
      margin: 0 0 26px;
      color: #111827 !important;
      font-size: 26px;
      font-weight: 950;
      line-height: 1;
      text-align: center;
    }
    .scan-frame {
      position: relative;
      width: 390px;
      padding: 25px;
      margin-bottom: 34px;
    }
    .qr-box {
      position: relative;
      width: 340px;
      height: 340px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(15, 23, 42, .28);
      background: #ffffff !important;
    }
    .qr-box > img {
      width: 294px;
      height: 294px;
      object-fit: contain;
    }
    .qr-logo {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 84px;
      height: 84px;
      display: grid;
      place-items: center;
      transform: translate(-50%, -50%);
      padding: 7px;
      border: 2px solid rgba(15, 23, 42, .14);
      border-radius: 14px;
      background: #ffffff !important;
      box-shadow: 0 2px 12px rgba(15, 23, 42, .16);
      overflow: hidden;
    }
    .corner {
      position: absolute;
      width: 66px;
      height: 66px;
      border-color: ${primary};
      border-style: solid;
      filter: drop-shadow(0 2px 2px rgba(15, 23, 42, .2));
      z-index: 3;
    }
    .tl { top: 0; left: 0; border-width: 9px 0 0 9px; border-top-left-radius: 24px; }
    .tr { top: 0; right: 0; border-width: 9px 9px 0 0; border-top-right-radius: 24px; }
    .bl { bottom: 0; left: 0; border-width: 0 0 9px 9px; border-bottom-left-radius: 24px; }
    .br { right: 0; bottom: 0; border-width: 0 9px 9px 0; border-bottom-right-radius: 24px; }
    .table-name {
      width: 430px;
      min-height: 58px;
      display: grid;
      place-items: center;
      padding: 10px 20px;
      background: #111827 !important;
      color: #ffffff !important;
      font-size: 34px;
      font-weight: 950;
      line-height: 1;
      text-align: center;
      text-transform: uppercase;
    }
    .restaurant {
      margin: 18px 0 0;
      color: #6b7280 !important;
      font-size: 14px;
      font-weight: 700;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="scan-card">
    <div class="brand"><img src="${logoUrl}" alt="${this.escapeHtml(restaurantName)}"></div>
    <h1>SCAN TO ORDER</h1>
    <div class="scan-frame">
      <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
      <div class="qr-box">
        <img src="${qrUrl}" alt="QR Code">
        <div class="qr-logo"><img src="${logoUrl}" alt="${this.escapeHtml(restaurantName)}"></div>
      </div>
    </div>
    <div class="table-name">${this.escapeHtml(tableName)}</div>
    <p class="restaurant">${this.escapeHtml(restaurantName)}</p>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 500);
    };
  </script>
</body>
</html>`);
        windowPrint.document.close();
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

        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 1200;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const primary = this.primaryColor();
        const logo = await this.loadImage(this.restaurantLogo());
        const qrUrl = this.tableQrUrl(this.tableDetail);
        if (!qrUrl) return;
        const qr = await this.loadImage(qrUrl);
        const restaurantName = this.restaurantName();
        const tableName = this.tableDetail.name;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = primary;
        this.roundRect(ctx, 332, 92, 236, 116, 22);
        ctx.fill();
        ctx.strokeStyle = "rgba(15, 23, 42, .12)";
        ctx.lineWidth = 3;
        this.roundRect(ctx, 332, 92, 236, 116, 22);
        ctx.stroke();
        if (logo) this.drawContainImage(ctx, logo, 362, 110, 176, 88);

        ctx.fillStyle = "#111827";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.font = "900 42px Arial";
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

        ctx.fillStyle = "#6b7280";
        ctx.font = "700 22px Arial";
        ctx.fillText(this.truncateText(ctx, restaurantName, 620), 450, 1002);

        const link = document.createElement("a");
        link.download = `qr-table-${tableName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }

    private async printTemplateQRCode(): Promise<void> {
        const canvas = await this.buildPremiumQrCanvas();
        if (!canvas || !this.tableDetail) return;

        const imageUrl = canvas.toDataURL("image/png");
        const printWindow = window.open("", "", "left=0,top=0,width=980,height=1200");
        if (!printWindow) return;

        printWindow.document.write(`
<html>
<head>
  <title>QR Code - ${this.escapeHtml(this.tableDetail.name)}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; display: grid; place-items: center; background: #fff; overflow: hidden; }
    img { max-width: calc(100vw - 12mm); max-height: calc(100vh - 12mm); width: auto; height: auto; display: block; object-fit: contain; }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="QR Code ${this.escapeHtml(this.tableDetail.name)}">
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

        const logo = await this.loadImage(this.restaurantLogo());
        const qrUrl = this.tableQrUrl(this.tableDetail);
        if (!qrUrl) return null;
        const qr = await this.loadImage(qrUrl);
        if (!qr) return null;
        const [burgerImage, wrapImage, promoImage] = await Promise.all([
            this.loadImage("assets/images/humb.jpg"),
            this.loadImage("assets/images/cha3.png"),
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
        const primary = info.primary;
        ctx.fillStyle = "#eef2f7";
        ctx.fillRect(0, 0, 900, 1273);
        ctx.fillStyle = "#cbd5e1";
        this.roundRect(ctx, 58, 44, 784, 1185, 12);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        this.roundRect(ctx, 82, 72, 736, 1128, 6);
        ctx.fill();

        if (foodAssets?.burgerImage) {
            ctx.save();
            this.roundRect(ctx, 82, 900, 736, 300, 6);
            ctx.clip();
            ctx.globalAlpha = 0.18;
            this.drawCoverImage(ctx, foodAssets.burgerImage, 82, 900, 736, 300);
            ctx.globalAlpha = 0.92;
            const fade = ctx.createLinearGradient(82, 900, 82, 1200);
            fade.addColorStop(0, "rgba(255,255,255,.25)");
            fade.addColorStop(0.52, "rgba(255,255,255,.88)");
            fade.addColorStop(1, "#ffffff");
            ctx.fillStyle = fade;
            ctx.fillRect(82, 900, 736, 300);
            ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.arc(245, 650, 270, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        if (logo) {
            ctx.fillStyle = "#ffffff";
            this.roundRect(ctx, 145, 118, 116, 88, 14);
            ctx.fill();
            ctx.strokeStyle = primary;
            ctx.lineWidth = 3;
            this.roundRect(ctx, 145, 118, 116, 88, 14);
            ctx.stroke();
            ctx.drawImage(logo, 159, 132, 88, 60);
        } else {
            ctx.fillStyle = primary;
            this.roundRect(ctx, 145, 118, 116, 88, 14);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "900 42px Arial";
            ctx.textAlign = "center";
            ctx.fillText(String(info.name || "R").slice(0, 1).toUpperCase(), 203, 162);
            ctx.textAlign = "left";
        }

        ctx.fillStyle = "#111827";
        ctx.font = "900 34px Arial";
        ctx.fillText(this.truncateText(ctx, info.name, 445), 285, 148);
        ctx.fillStyle = "#6b7280";
        ctx.font = "600 20px Arial";
        ctx.fillText(this.truncateText(ctx, info.slogan, 430), 285, 184);

        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#2f343b";
        ctx.font = "900 46px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Digital Menu", 250, 300);
        ctx.fillText("System", 250, 354);

        ctx.fillStyle = "#ffffff";
        this.roundRect(ctx, 245, 410, 410, 410, 34);
        ctx.fill();
        ctx.strokeStyle = primary;
        ctx.lineWidth = 5;
        this.roundRect(ctx, 245, 410, 410, 410, 34);
        ctx.stroke();
        ctx.drawImage(qr, 285, 450, 330, 330);

        ctx.fillStyle = "#2f343b";
        ctx.font = "900 54px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Menu", 450, 900);

        ctx.fillStyle = "#111827";
        ctx.font = "42px Georgia";
        ctx.fillText(this.truncateText(ctx, info.name, 620), 450, 980);

        ctx.fillStyle = primary;
        ctx.font = "900 28px Arial";
        ctx.fillText(`Table ${this.truncateText(ctx, info.tableName, 360)}`, 450, 1040);

        ctx.fillStyle = "#374151";
        ctx.font = "24px Arial";
        ctx.fillText(this.truncateText(ctx, info.phone, 620), 450, 1100);
        ctx.fillText(this.truncateText(ctx, info.menuUrl, 660), 450, 1152);
    }

    private drawTableTentTemplate(ctx: CanvasRenderingContext2D, qr: HTMLImageElement, logo: HTMLImageElement | null, info: any, foodAssets: any): void {
        const primary = info.primary;
        const pageGradient = ctx.createLinearGradient(0, 0, 900, 1273);
        pageGradient.addColorStop(0, "#f7efe6");
        pageGradient.addColorStop(1, "#b58b62");
        ctx.fillStyle = pageGradient;
        ctx.fillRect(0, 0, 900, 1273);

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,.45)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 20;
        ctx.fillStyle = "rgba(255,255,255,.22)";
        this.roundRect(ctx, 102, 58, 706, 1140, 10);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "rgba(255,255,255,.45)";
        this.roundRect(ctx, 118, 74, 674, 1108, 8);
        ctx.fill();

        const cardGradient = ctx.createLinearGradient(132, 86, 768, 1170);
        cardGradient.addColorStop(0, "#d86d25");
        cardGradient.addColorStop(0.42, this.colorWithAlpha(primary, 0.96));
        cardGradient.addColorStop(1, "#9f3717");
        ctx.fillStyle = cardGradient;
        this.roundRect(ctx, 132, 86, 636, 1084, 5);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.beginPath();
        ctx.arc(735, 146, 86, 0, Math.PI * 2);
        ctx.arc(220, 1040, 150, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (logo) {
            ctx.fillStyle = "rgba(255,255,255,.94)";
            this.roundRect(ctx, 352, 118, 196, 90, 18);
            ctx.fill();
            this.drawContainImage(ctx, logo, 372, 136, 156, 54);
        }

        ctx.fillStyle = "#fff2b8";
        ctx.font = "900 36px Arial";
        ctx.fillText(this.truncateText(ctx, info.name.toUpperCase(), 560), 450, logo ? 270 : 205);
        ctx.textBaseline = "alphabetic";

        ctx.save();
        ctx.translate(192, 646);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 92px Arial";
        ctx.fillText("MENU", 0, 0);
        ctx.restore();

        ctx.fillStyle = "#ffffff";
        this.roundRect(ctx, 268, 332, 462, 462, 18);
        ctx.fill();
        ctx.fillStyle = "rgba(159,55,23,.12)";
        this.roundRect(ctx, 292, 356, 414, 414, 12);
        ctx.fill();
        ctx.drawImage(qr, 310, 374, 378, 378);

        ctx.fillStyle = "#fff2b8";
        ctx.font = "900 34px Arial";
        ctx.fillText("SCAN QR CODE", 500, 852);

        ctx.fillStyle = "#111827";
        ctx.fillRect(246, 892, 508, 80);
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 42px Arial";
        ctx.fillText(this.truncateText(ctx, info.tableName, 360).toUpperCase(), 500, 945);

        if (foodAssets?.shawarmaImage) {
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,.38)";
            ctx.shadowBlur = 22;
            ctx.shadowOffsetY = 14;
            this.drawContainImage(ctx, foodAssets.shawarmaImage, 386, 946, 400, 280);
            ctx.restore();
        }
    }

    private restaurantPrintInfo(): any {
        const restaurant = this.restaurantSession();
        return {
            name: this.restaurantName(),
            phone: restaurant?.owner_phone || restaurant?.settings?.whatsapp_order_phone || "+243",
            slogan: restaurant?.settings?.slogan || "Menu digital QR code",
            menuUrl: this.menuUrl(restaurant),
            primary: this.primaryColor(),
            tableName: this.tableDetail?.name || "",
        };
    }

    private selectedQrTemplate(): "poster" | "table_tent" {
        const template = this.restaurantSession()?.settings?.qr_template;
        return template === "table_tent" ? "table_tent" : "poster";
    }

    private canUsePremiumQrTemplates(): boolean {
        const restaurant = this.restaurantSession();
        const slug = String(restaurant?.plan?.slug || restaurant?.plan?.name || "").toLowerCase();
        return Boolean(restaurant?.features?.customization) || slug.includes("pro") || slug.includes("business");
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
