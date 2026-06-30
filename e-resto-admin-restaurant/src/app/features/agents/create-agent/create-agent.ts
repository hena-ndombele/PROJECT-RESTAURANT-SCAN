import { CommonModule } from "@angular/common";
import { Component, ElementRef, Input, ViewChild, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import Swal from "sweetalert2";
import { AgentService } from "../../../services/agents/agent-service";
import { STORAGE_ROOT } from "../../../services/api-url";

@Component({
  selector: "app-create-agent",
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: "./create-agent.html",
  styleUrl: "./create-agent.scss",
  standalone: true
})
export class CreateAgent {
  @Input() disabled = false;
  @Input() limitMessage = "";
  @ViewChild("badgePreview") badgePreview?: ElementRef<HTMLElement>;

  isLoading = false;
  currentStep = 1;
  readonly totalSteps = 3;
  selectedPhoto?: File;
  photoPreview = "";
  createdAgent: any = null;
  badgeQrCode = "";

  private agentService = inject(AgentService);

  restaurantData = this.resolveRestaurantData();

  agentForm = new FormGroup({
    first_name: new FormControl("", [Validators.required]),
    last_name: new FormControl("", [Validators.required]),
    email: new FormControl("", [Validators.required, Validators.email]),
    phone_number: new FormControl("", [Validators.required]),
    address: new FormControl("", [Validators.required]),
    education_level: new FormControl(""),
    fonction: new FormControl("", [Validators.required]),
    matricule: new FormControl("", [Validators.required]),
    status: new FormControl("active"),
    contract_type: new FormControl("CDI"),
    shift: new FormControl("Jour"),
    hired_at: new FormControl(""),
    emergency_contact_name: new FormControl(""),
    emergency_contact_phone: new FormControl(""),
  });

  get fullName(): string {
    const firstName = this.agentForm.get("first_name")?.value || "Prenom";
    const lastName = this.agentForm.get("last_name")?.value || "Nom";
    return `${firstName} ${lastName}`.trim();
  }

  get badgeMatricule(): string {
    return this.createdAgent?.matricule || this.agentForm.get("matricule")?.value || "Genere automatiquement";
  }

  get badgePhoto(): string {
    return this.photoPreview || this.createdAgent?.photo_url || "";
  }

  get previewQrCode(): string {
    return this.badgeQrCode || this.localQrPlaceholder();
  }

  nextStep(): void {
    if (!this.validateStep(this.currentStep)) {
      return;
    }

    this.currentStep = Math.min(this.currentStep + 1, this.totalSteps);
  }

  previousStep(): void {
    this.currentStep = Math.max(this.currentStep - 1, 1);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.selectedPhoto = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  }

  onSubmit(): void {
    if (this.disabled) {
      Swal.fire("Plan limité", this.limitMessage || "Votre plan ne permet pas de créer plus d'employés.", "warning");
      return;
    }

    if (!this.agentForm.valid) {
      this.agentForm.markAllAsTouched();
      return;
    }

    const payload = this.buildFormData();
    this.createAgent(payload);
  }

  createAgent(agentData: FormData): void {
    this.isLoading = true;
    this.agentService.create(agentData).subscribe({
      next: async (response) => {
        this.isLoading = false;
        this.createdAgent = response?.agent || null;
        this.badgeQrCode = response?.qr_code || this.badgeQrCode;

        const result = await Swal.fire({
          title: "Employé créé",
          text: "Le compte employé et son badge professionnel sont prêts.",
          icon: "success",
          confirmButtonText: "Télécharger le badge",
          showCancelButton: true,
          cancelButtonText: "Fermer",
          confirmButtonColor: "#ff7a1a"
        });

        if (result.isConfirmed && this.createdAgent) {
          await this.downloadBadge();
          setTimeout(() => window.location.reload(), 700);
        } else {
          window.location.reload();
        }
      },
      error: (err) => {
        this.isLoading = false;
        const emailError = err.error?.errors?.email?.[0];
        const matriculeError = err.error?.errors?.matricule?.[0];
        const message = emailError
          ? emailError
          : matriculeError
            ? "Ce matricule existe déjà. Saisissez un matricule unique."
            : err.error?.message || "Erreur lors de la création de l'employé.";
        Swal.fire({
          title: "Création impossible",
          text: message,
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "Réessayer"
        });
      }
    });
  }

  async downloadBadge(): Promise<void> {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 440;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const primary = this.restaurantData.primaryColor;
    const accent = this.restaurantData.accentColor;
    const agent = this.createdAgent || {};
    const matricule = agent.matricule || this.badgeMatricule;
    const role = agent.fonction || this.agentForm.get("fonction")?.value || "Employe";

    this.roundRect(ctx, 0, 0, 720, 440, 28);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e6e8ee";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, 720, 118);
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, 14, 440);
    ctx.fillStyle = accent;
    ctx.fillRect(14, 112, 706, 6);

    ctx.fillStyle = "#111318";
    ctx.font = "700 30px Arial";
    ctx.fillText(this.restaurantData.name, 128, 48);
    ctx.font = "500 18px Arial";
    ctx.fillStyle = "#697386";
    ctx.fillText("Badge professionnel employé", 128, 78);

    await this.drawImageSafe(ctx, this.restaurantData.logo, 36, 24, 72, 72, 16);
    await this.drawImageSafe(ctx, this.badgePhoto, 42, 150, 170, 190, 22, true);

    ctx.fillStyle = "#111318";
    ctx.font = "700 34px Arial";
    ctx.fillText(this.fullName, 240, 178);
    ctx.fillStyle = primary;
    ctx.font = "700 24px Arial";
    ctx.fillText(role, 240, 220);
    ctx.fillStyle = "#697386";
    ctx.font = "500 18px Arial";
    ctx.fillText(this.restaurantData.name, 240, 256);

    ctx.fillStyle = "#111318";
    ctx.font = "700 18px Arial";
    ctx.fillText("Matricule", 240, 318);
    ctx.fillStyle = primary;
    ctx.font = "700 28px Arial";
    ctx.fillText(matricule, 240, 352);

    ctx.fillStyle = "#ffffff";
    this.roundRect(ctx, 516, 146, 168, 198, 18);
    ctx.fill();
    ctx.strokeStyle = "#e6e8ee";
    ctx.lineWidth = 1;
    ctx.stroke();
    await this.drawImageSafe(ctx, this.previewQrCode, 532, 162, 136, 136, 8);
    ctx.fillStyle = "#697386";
    ctx.font = "500 14px Arial";
    ctx.fillText("Verification QR", 548, 326);

    const link = document.createElement("a");
    link.download = `badge-${String(matricule).replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  validateStep(step: number): boolean {
    const controlsByStep: Record<number, string[]> = {
      1: ["first_name", "last_name", "email", "phone_number", "address"],
      2: ["fonction", "matricule"],
      3: [],
    };

    const controls = controlsByStep[step] || [];
    controls.forEach((control) => this.agentForm.get(control)?.markAsTouched());
    return controls.every((control) => this.agentForm.get(control)?.valid);
  }

  private buildFormData(): FormData {
    const formData = new FormData();
    Object.entries(this.agentForm.value).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        formData.append(key, String(value));
      }
    });

    if (this.selectedPhoto) {
      formData.append("photo", this.selectedPhoto);
    }

    return formData;
  }

  private resolveRestaurantData(): { name: string; logo: string; primaryColor: string; accentColor: string } {
    const fallback = {
      name: "Restaurant Scan",
      logo: "assets/logo/e-resto-logo.png",
      primaryColor: "#ff7a1a",
      accentColor: "#ff7a1a",
    };

    try {
      const userData = JSON.parse(localStorage.getItem("user_data") || "null");
      const restaurant = JSON.parse(localStorage.getItem("restaurant_session") || "null") || userData?.restaurant;
      const theme = restaurant?.theme || restaurant?.settings?.theme || restaurant?.settings || {};
      return {
        name: restaurant?.name || fallback.name,
        logo: restaurant?.logo_url || (restaurant?.logo ? `${STORAGE_ROOT}/${restaurant.logo}` : fallback.logo),
        primaryColor: theme.primaryColor || theme.primary_color || theme.brandColor || theme.brand_color || fallback.primaryColor,
        accentColor: theme.accentColor || theme.accent_color || fallback.accentColor,
      };
    } catch {
      return fallback;
    }
  }

  private localQrPlaceholder(): string {
    const seed = `${this.fullName}|${this.badgeMatricule}|${this.agentForm.get("fonction")?.value || ""}`;
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
    drawPlaceholder = false
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!source) {
        if (drawPlaceholder) {
          this.drawInitials(ctx, x, y, width, height, radius);
        }
        resolve();
        return;
      }

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        ctx.save();
        this.roundRect(ctx, x, y, width, height, radius);
        ctx.clip();
        ctx.drawImage(image, x, y, width, height);
        ctx.restore();
        resolve();
      };
      image.onerror = () => {
        if (drawPlaceholder) {
          this.drawInitials(ctx, x, y, width, height, radius);
        }
        resolve();
      };
      image.src = source;
    });
  }

  private drawInitials(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    this.roundRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = "#2b2f38";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 54px Arial";
    const initials = this.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    ctx.fillText(initials || "RS", x + 46, y + 112);
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
