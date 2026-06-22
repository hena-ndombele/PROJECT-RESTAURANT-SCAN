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
        return getComputedStyle(document.documentElement).getPropertyValue("--dashboard-primary").trim() || "#F9A11B";
    }

    printQRCode(): void {
        if (!this.tableDetail?.qr_url) return;

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
      height: 88px;
      display: grid;
      place-items: center;
      margin-bottom: 24px;
      padding: 12px 16px;
      border: 2px solid rgba(15, 23, 42, .12);
      border-radius: 14px;
      background: ${primary} !important;
    }
    .brand img,
    .qr-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    h1 {
      margin: 0 0 26px;
      color: #111827 !important;
      font-size: 34px;
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
      height: 62px;
      display: grid;
      place-items: center;
      transform: translate(-50%, -50%);
      padding: 7px;
      border: 2px solid rgba(15, 23, 42, .14);
      border-radius: 10px;
      background: #ffffff !important;
      box-shadow: 0 2px 12px rgba(15, 23, 42, .16);
    }
    .corner {
      position: absolute;
      width: 66px;
      height: 66px;
      border-color: #ffffff;
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
        if (logo) ctx.drawImage(logo, 362, 118, 176, 64);

        ctx.fillStyle = "#111827";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.font = "900 54px Arial";
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
            ctx.drawImage(logo, 408, 554, 84, 42);
        }

        this.drawCorner(ctx, frameX, frameY, "tl");
        this.drawCorner(ctx, frameX + frameSize, frameY, "tr");
        this.drawCorner(ctx, frameX, frameY + frameSize, "bl");
        this.drawCorner(ctx, frameX + frameSize, frameY + frameSize, "br");

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

    private drawCorner(ctx: CanvasRenderingContext2D, x: number, y: number, corner: "tl" | "tr" | "bl" | "br"): void {
        const size = 74;
        const radius = 22;
        ctx.save();
        ctx.strokeStyle = "#ffffff";
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
}
