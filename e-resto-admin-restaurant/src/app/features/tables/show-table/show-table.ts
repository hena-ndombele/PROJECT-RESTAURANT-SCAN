import { Component, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { TableDto } from "../../../models/table/TableDto";
import { STORAGE_ROOT } from "../../../services/api-url";

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

    primaryColor(): string {
        return getComputedStyle(document.documentElement).getPropertyValue("--dashboard-primary").trim() || "#F9A11B";
    }

    printQRCode(): void {
        if (!this.tableDetail?.qr_url) return;

        const logoUrl = this.restaurantLogo();
        const primary = this.primaryColor();
        const restaurantName = this.restaurantName();
        const tableName = this.tableDetail.name;
        const windowPrint = window.open("", "", "left=0,top=0,width=980,height=760");

        if (!windowPrint) return;

        windowPrint.document.write(`
<html>
<head>
  <title>QR Code - ${this.escapeHtml(tableName)}</title>
  <style>
    @page { size: landscape; margin: 8mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
    }
    .menu-card {
      width: 900px;
      min-height: 540px;
      display: grid;
      grid-template-columns: 1.05fr .95fr;
      gap: 34px;
      align-items: center;
      padding: 42px;
      border: 5px solid ${primary};
      border-radius: 8px;
      background: #ffffff !important;
      color: #111827 !important;
      box-shadow: 0 18px 50px rgba(17,24,39,.18);
    }
    .qr-block {
      display: grid;
      place-items: center;
      min-height: 420px;
      border: 3px solid #111827;
      background: #ffffff !important;
      position: relative;
    }
    .main-qr { width: 360px; height: 360px; display: block; }
    .qr-logo {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 96px;
      height: 74px;
      display: grid;
      place-items: center;
      padding: 7px;
      border: 3px solid ${primary};
      border-radius: 5px;
      background: #ffffff !important;
      box-shadow: 0 0 14px rgba(0,0,0,.14);
    }
    .qr-logo img,
    .brand-logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .content {
      min-height: 420px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-left: 7px solid ${primary};
      padding-left: 34px;
    }
    .brand-logo-wrap {
      width: 170px;
      height: 104px;
      margin-bottom: 20px;
      background: #ffffff !important;
    }
    .eyebrow {
      font-size: 35px;
      line-height: 1;
      font-weight: 950;
      text-transform: uppercase;
      color: #111827 !important;
    }
    .menu {
      margin: 2px 0 16px;
      font-size: 84px;
      line-height: .9;
      font-weight: 950;
      text-transform: uppercase;
      color: ${primary} !important;
    }
    .restaurant {
      margin: 0 0 16px;
      font-size: 22px;
      font-weight: 900;
      color: #111827 !important;
    }
    .hint {
      max-width: 310px;
      margin: 0 0 22px;
      color: #4b5563 !important;
      font-size: 17px;
      line-height: 1.4;
    }
    .table-name {
      width: 300px;
      min-height: 54px;
      display: grid;
      place-items: center;
      border: 4px solid ${primary};
      background: #ffffff !important;
      color: #111827 !important;
      font-size: 28px;
      font-weight: 950;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="menu-card">
    <div class="qr-block">
      <img src="${this.tableDetail.qr_url}" class="main-qr" alt="QR Code">
      <div class="qr-logo"><img src="${logoUrl}" alt="Logo"></div>
    </div>
    <div class="content">
      <div class="brand-logo-wrap"><img class="brand-logo" src="${logoUrl}" alt="Logo"></div>
      <div class="eyebrow">SCAN FOR OUR</div>
      <div class="menu">MENU</div>
      <p class="restaurant">${this.escapeHtml(restaurantName)}</p>
      <p class="hint">Scannez le QR code pour consulter le menu et commander depuis votre table.</p>
      <div class="table-name">${this.escapeHtml(tableName)}</div>
    </div>
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

        const canvas = document.createElement("canvas");
        canvas.width = 1400;
        canvas.height = 860;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const primary = this.primaryColor();
        const logo = await this.loadImage(this.restaurantLogo());
        const qr = await this.loadImage(this.tableDetail.qr_url);
        const restaurantName = this.restaurantName();
        const tableName = this.tableDetail.name;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#ffffff";
        this.roundRect(ctx, 70, 70, 1260, 720, 10);
        ctx.fill();
        ctx.strokeStyle = primary;
        ctx.lineWidth = 10;
        this.roundRect(ctx, 70, 70, 1260, 720, 10);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        this.roundRect(ctx, 130, 150, 560, 560, 0);
        ctx.fill();
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 5;
        this.roundRect(ctx, 130, 150, 560, 560, 0);
        ctx.stroke();

        if (qr) {
            ctx.drawImage(qr, 170, 190, 480, 480);
        }

        if (logo) {
            ctx.fillStyle = "#ffffff";
            this.roundRect(ctx, 342, 382, 136, 96, 8);
            ctx.fill();
            ctx.strokeStyle = primary;
            ctx.lineWidth = 4;
            this.roundRect(ctx, 342, 382, 136, 96, 8);
            ctx.stroke();
            ctx.drawImage(logo, 358, 397, 104, 66);
            ctx.drawImage(logo, 810, 155, 190, 120);
        }

        ctx.fillStyle = primary;
        ctx.fillRect(750, 150, 8, 560);

        ctx.fillStyle = "#111827";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = "900 54px Arial";
        ctx.fillText("SCAN FOR OUR", 810, 355);

        ctx.fillStyle = primary;
        ctx.font = "900 128px Arial";
        ctx.fillText("MENU", 810, 465);

        ctx.fillStyle = "#111827";
        ctx.font = "900 34px Arial";
        ctx.fillText(this.truncateText(ctx, restaurantName, 430), 810, 525);

        ctx.fillStyle = "#4b5563";
        ctx.font = "500 24px Arial";
        this.wrapText(ctx, "Scannez le QR code pour consulter le menu et commander depuis votre table.", 810, 572, 430, 34);

        ctx.strokeStyle = primary;
        ctx.lineWidth = 5;
        ctx.strokeRect(810, 660, 360, 62);
        ctx.fillStyle = "#111827";
        ctx.textAlign = "center";
        ctx.font = "900 32px Arial";
        ctx.fillText(this.truncateText(ctx, tableName.toUpperCase(), 320), 990, 702);

        const link = document.createElement("a");
        link.download = `qr-table-${tableName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
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
}
