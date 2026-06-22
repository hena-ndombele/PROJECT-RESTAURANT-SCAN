import {Component, Input, OnInit, inject} from "@angular/core";
import {AgentDto} from "../../../models/agents/AgentDto";
import {DatePipe} from "@angular/common";
import {AgentService} from "../../../services/agents/agent-service";
import { STORAGE_ROOT } from "../../../services/api-url";

interface BadgeRestaurantData {
  name: string;
  logo: string;
  primaryColor: string;
  accentColor: string;
}

@Component({
  selector: "app-show-agent",
    imports: [
        DatePipe
    ],
  templateUrl: "./show-agent.html",
  styleUrl: "./show-agent.scss",
  standalone:true
})
export class ShowAgent implements OnInit{
  private agentService = inject(AgentService);
  @Input() agent:AgentDto | undefined;
  @Input() agentId:string | null = null;
  agentDetail!: AgentDto;
  restaurantData: BadgeRestaurantData = this.resolveRestaurantData();
  isBadgeGenerating = false;

  ngOnInit() {
    if(this.agent) {
      this.agentDetail = this.agent;
    }
  }

  initials(): string {
    return `${this.agentDetail?.first_name?.[0] || ''}${this.agentDetail?.last_name?.[0] || ''}`.toUpperCase() || 'RS';
  }

  async downloadBadge(): Promise<void> {
    if (!this.agentDetail || this.isBadgeGenerating) return;
    this.isBadgeGenerating = true;

    try {
      const badgeData = await this.resolveBadgeData();
      const badgeQrCode = badgeData.qrCode;
      const logoSource = badgeData.restaurantLogo || await this.imageSourceToDataUrl(this.restaurantData.logo);
      const photoSource = badgeData.photo || await this.imageSourceToDataUrl((this.agentDetail as any).photo_data_url || this.agentDetail.photo_url || "");

      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 460;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const fullName = `${this.agentDetail.first_name || ""} ${this.agentDetail.last_name || ""}`.trim() || "Employe";
      const matricule = this.agentDetail.matricule || "Non renseigne";
      const role = this.agentDetail.fonction || "Employe";

      this.roundRect(ctx, 0, 0, 720, 460, 30);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.stroke();

      const gradient = ctx.createLinearGradient(0, 0, 720, 0);
      gradient.addColorStop(0, this.restaurantData.primaryColor);
      gradient.addColorStop(1, this.restaurantData.accentColor);
      ctx.fillStyle = gradient;
      this.roundRect(ctx, 20, 20, 680, 112, 24);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,.16)";
      ctx.beginPath();
      ctx.arc(640, 76, 86, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(580, 30, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      this.roundRect(ctx, 42, 42, 72, 72, 18);
      ctx.fill();
      await this.drawImageSafe(ctx, logoSource, 50, 50, 56, 56, 12);

      ctx.fillStyle = this.restaurantData.primaryColor;
      this.roundRect(ctx, 20, 146, 190, 246, 26);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 30px Arial";
      this.fitText(ctx, this.restaurantData.name, 132, 66, 410);
      ctx.font = "600 16px Arial";
      ctx.fillText("Badge professionnel employe", 132, 96);

      ctx.fillStyle = "#ffffff";
      this.roundRect(ctx, 42, 166, 146, 174, 24);
      ctx.fill();
      await this.drawImageSafe(ctx, photoSource, 48, 172, 134, 162, 20, true, true);

      ctx.fillStyle = "rgba(255,255,255,.94)";
      ctx.font = "700 14px Arial";
      ctx.fillText("EMPLOYE", 80, 368);

      ctx.fillStyle = "#111318";
      ctx.font = "800 34px Arial";
      this.fitText(ctx, fullName, 240, 190, 250);
      ctx.fillStyle = this.restaurantData.primaryColor;
      ctx.font = "800 22px Arial";
      this.fitText(ctx, role, 240, 226, 250);
      ctx.fillStyle = "#697386";
      ctx.font = "600 16px Arial";
      this.fitText(ctx, this.restaurantData.name, 240, 258, 250);

      ctx.fillStyle = "#f8fafc";
      this.roundRect(ctx, 238, 286, 252, 84, 18);
      ctx.fill();
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#111318";
      ctx.font = "800 14px Arial";
      ctx.fillText("MATRICULE", 258, 318);
      ctx.fillStyle = this.restaurantData.primaryColor;
      ctx.font = "800 28px Arial";
      this.fitText(ctx, matricule, 258, 350, 210);

      ctx.fillStyle = "#ffffff";
      this.roundRect(ctx, 512, 148, 168, 214, 22);
      ctx.fill();
      ctx.strokeStyle = this.restaurantData.primaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      await this.drawImageSafe(ctx, badgeQrCode, 522, 158, 148, 148, 10);
      ctx.fillStyle = "#111318";
      ctx.font = "800 13px Arial";
      ctx.fillText("SCAN VERIFICATION", 528, 332);

      ctx.fillStyle = "#64748b";
      ctx.font = "600 13px Arial";
      ctx.fillText("Presentez ce badge au responsable", 238, 410);
      ctx.fillStyle = this.restaurantData.primaryColor;
      this.roundRect(ctx, 42, 414, 636, 8, 4);
      ctx.fill();

      await this.saveCanvas(canvas, `badge-${String(matricule).replace(/\s+/g, "-")}.png`);
    } catch {
      window.alert("Impossible de reimprimer le badge. Verifiez que le backend Laravel est demarre puis reessayez.");
    } finally {
      this.isBadgeGenerating = false;
    }
  }

  private resolveBadgeData(): Promise<{ qrCode: string; photo: string; restaurantLogo: string }> {
    if (!this.agentDetail?.id) {
      return Promise.resolve({
        qrCode: this.localQrPlaceholder(this.localQrPayload()),
        photo: "",
        restaurantLogo: "",
      });
    }

    return new Promise((resolve) => {
      this.agentService.show(this.agentDetail.id).subscribe({
        next: (response) => {
          const agent = response?.agent;
          if (agent) {
            this.agentDetail = { ...this.agentDetail, ...agent };
          }
          if (response?.restaurant?.name) {
            this.restaurantData = { ...this.restaurantData, name: response.restaurant.name };
          }
          resolve({
            qrCode: response?.qr_code || this.localQrPlaceholder(this.localQrPayload()),
            photo: response?.agent?.photo_data_url || "",
            restaurantLogo: response?.restaurant?.logo_data_url || "",
          });
        },
        error: () => resolve({
          qrCode: this.localQrPlaceholder(this.localQrPayload()),
          photo: "",
          restaurantLogo: "",
        }),
      });
    });
  }

  private localQrPayload(): string {
    const payload = {
      type: "employee_badge",
      restaurant: this.restaurantData.name,
      employee_id: this.agentDetail?.id,
      matricule: this.agentDetail?.matricule,
      name: `${this.agentDetail?.first_name || ""} ${this.agentDetail?.last_name || ""}`.trim(),
      fonction: this.agentDetail?.fonction || "",
    };

    return JSON.stringify(payload);
  }

  private resolveRestaurantData(): BadgeRestaurantData {
    const fallback = {
      name: "Restaurant Scan",
      logo: "assets/logo/e-resto-logo.png",
      primaryColor: "#F9A11B",
      accentColor: "#FFD166",
    };

    try {
      const userData = JSON.parse(localStorage.getItem("user_data") || "null");
      const restaurant = JSON.parse(localStorage.getItem("restaurant_session") || "null") || userData?.restaurant;
      const theme = restaurant?.theme || restaurant?.settings?.theme || restaurant?.settings || {};
      return {
        name: restaurant?.name || fallback.name,
        logo: restaurant?.logo_url || (restaurant?.logo ? `${STORAGE_ROOT}/${restaurant.logo}` : fallback.logo),
        primaryColor: theme.primary || theme.primary_color || theme.brandColor || theme.brand_color || fallback.primaryColor,
        accentColor: theme.secondary || theme.accent || theme.accentColor || theme.accent_color || fallback.accentColor,
      };
    } catch {
      return fallback;
    }
  }

  private localQrPlaceholder(seed: string): string {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
    }

    const cells = 17;
    const size = 170;
    const cell = size / cells;
    let rects = "";
    for (let y = 0; y < cells; y += 1) {
      for (let x = 0; x < cells; x += 1) {
        const finder = (x < 5 && y < 5) || (x > 11 && y < 5) || (x < 5 && y > 11);
        const filled = finder || ((x * 7 + y * 11 + hash) % 5 === 0);
        if (filled) {
          rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell - 1}" height="${cell - 1}" rx="1"/>`;
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#fff"/><g fill="#111318">${rects}</g></svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  private drawImageSafe(
    ctx: CanvasRenderingContext2D,
    source: string,
    x: number,
    y: number,
    width: number,
    height: number,
    radius = 0,
    drawPlaceholder = false,
    cover = false
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!source) {
        if (drawPlaceholder) this.drawInitials(ctx, x, y, width, height, radius);
        resolve();
        return;
      }

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        ctx.save();
        this.roundRect(ctx, x, y, width, height, radius);
        ctx.clip();
        if (cover) {
          this.drawImageCover(ctx, image, x, y, width, height);
        } else {
          ctx.drawImage(image, x, y, width, height);
        }
        ctx.restore();
        resolve();
      };
      image.onerror = () => {
        if (drawPlaceholder) this.drawInitials(ctx, x, y, width, height, radius);
        resolve();
      };
      image.src = source;
    });
  }

  private async imageSourceToDataUrl(source: string): Promise<string> {
    if (!source || source.startsWith("data:") || source.startsWith("assets/") || source.startsWith("/assets/")) {
      return source;
    }

    try {
      const response = await fetch(source, { mode: "cors" });
      if (!response.ok) return "";
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  }

  private saveCanvas(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Impossible de generer le badge."));
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    });
  }

  private drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
    const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * ratio;
    const drawHeight = image.naturalHeight * ratio;
    const offsetX = x + (width - drawWidth) / 2;
    const offsetY = y + (height - drawHeight) / 2;
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  }

  private fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number): void {
    if (ctx.measureText(text).width <= maxWidth) {
      ctx.fillText(text, x, y);
      return;
    }

    let shortened = text;
    while (shortened.length > 3 && ctx.measureText(`${shortened}...`).width > maxWidth) {
      shortened = shortened.slice(0, -1);
    }
    ctx.fillText(`${shortened}...`, x, y);
  }

  private drawInitials(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    this.roundRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = "#2b2f38";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 54px Arial";
    ctx.fillText(this.initials(), x + 46, y + 112);
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
}
