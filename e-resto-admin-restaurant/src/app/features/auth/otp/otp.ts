import { CommonModule } from "@angular/common";
import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import Swal from "sweetalert2";
import { AuthService } from "../../../services/auth/auth-service";

@Component({
  selector: "app-otp",
  imports: [
    FormsModule,
    RouterLink,
    CommonModule,
  ],
  templateUrl: "./otp.html",
  styleUrl: "./otp.scss",
})
export class Otp implements OnInit {
  isLoading = false;
  isResending = false;
  digits = ["", "", "", "", ""];
  toastMessage = "";
  toastType: "success" | "error" = "success";
  private toastTimer?: ReturnType<typeof setTimeout>;

  @ViewChild("otp1") otp1!: ElementRef<HTMLInputElement>;
  @ViewChild("otp2") otp2!: ElementRef<HTMLInputElement>;
  @ViewChild("otp3") otp3!: ElementRef<HTMLInputElement>;
  @ViewChild("otp4") otp4!: ElementRef<HTMLInputElement>;
  @ViewChild("otp5") otp5!: ElementRef<HTMLInputElement>;

  error: string | null = null;
  email = "";
  source: "login" | "signup" = "login";

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.source = this.route.snapshot.queryParamMap.get("source") === "signup" ? "signup" : "login";
    this.email = this.route.snapshot.queryParamMap.get("email")
      || localStorage.getItem("restaurant_owner_email")
      || "";
    const devOtp = localStorage.getItem("dev_otp");
    if (devOtp) {
      this.showToast(`Code OTP local: ${devOtp}`, "success");
    }

    this.authService.currentEmail.subscribe((email) => {
      this.email = email || this.email;
      if (!this.email) {
        this.router.navigate(["/restaurant/login"]);
      }
    });
  }

  onKeyUp(event: KeyboardEvent, index: number) {
    const input = event.target as HTMLInputElement;
    const key = event.key;

    if (input.value && index < 4 && key !== "Backspace") {
      const nextInput = this[`otp${index + 2}` as keyof Otp] as ElementRef<HTMLInputElement>;
      nextInput.nativeElement.focus();
    }

    if (key === "Backspace" && index > 0 && !input.value) {
      const prevInput = this[`otp${index}` as keyof Otp] as ElementRef<HTMLInputElement>;
      prevInput.nativeElement.focus();
    }
  }

  verifyOtp() {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.error = null;
    const fullCode = [this.otp1, this.otp2, this.otp3, this.otp4, this.otp5]
      .map((el) => el.nativeElement.value)
      .join("");

    if (fullCode.length < 5) {
      this.isLoading = false;
      this.error = "Veuillez entrer les 5 chiffres du code.";
      return;
    }

    this.authService.verifyOtp(this.email, fullCode).subscribe({
      next: (res) => {
        this.isLoading = false;
        localStorage.removeItem("dev_otp");
        if (this.source === "signup") {
          this.showClientUrlDialog(res);
          return;
        }

        this.router.navigate(["/dashboard"]);
      },
      error: (err) => {
        this.isLoading = false;
        Swal.fire({
          title: "Erreur",
          text: err.error?.message || "OTP incorrect.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "Reessayer",
        });
        this.error = err.error?.message || "Code invalide ou expire.";
      },
    });
  }

  resendCode(): void {
    if (!this.email || this.isResending) {
      return;
    }

    this.isResending = true;
    this.error = null;
    this.authService.requestOtp(this.email).subscribe({
      next: (response) => {
        this.isResending = false;
        if ((response as any).dev_otp) {
          localStorage.setItem("dev_otp", String((response as any).dev_otp));
          this.showToast(`Code OTP local: ${(response as any).dev_otp}`, "success");
          return;
        }
        this.showToast(response.message || "Un nouveau code OTP a ete envoye a votre adresse email.", "success");
      },
      error: (err) => {
        this.isResending = false;
        const message = err.error?.message || "Impossible de renvoyer le code OTP.";
        this.error = message;
        this.showToast(message, "error");
      },
    });
  }

  hideToast(): void {
    this.toastMessage = "";
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = undefined;
    }
  }

  private showClientUrlDialog(response: any): void {
    const restaurant = response.restaurant
      || JSON.parse(localStorage.getItem("pending_signup_restaurant") || "null");
    const publicMenuUrl = this.buildMenuUrl(restaurant);

    if (restaurant) {
      localStorage.setItem("restaurant_session", JSON.stringify(restaurant));
      localStorage.removeItem("pending_signup_restaurant");
    }

    Swal.fire({
      title: "Compte verifie !",
      html: `
        <p>Votre espace restaurant est pret.</p>
        <p style="word-break: break-all; font-weight: 600;">${publicMenuUrl}</p>
      `,
      icon: "success",
      showCancelButton: true,
      confirmButtonText: "Acceder au dashboard",
      cancelButtonText: "Ouvrir le menu",
      confirmButtonColor: "#F9A11B",
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.cancel) {
        window.open(publicMenuUrl, "_blank", "noopener");
      }

      this.router.navigate(["/dashboard"]);
    });
  }

  private buildMenuUrl(restaurant: any): string {
    const base = window.location.origin.replace(":4200", ":5173");
    const slug = restaurant?.slug || this.slugify(restaurant?.name || "mon-restaurant");
    return `${base}/?restaurant_slug=${slug}`;
  }

  private slugify(value: string): string {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private showToast(message: string, type: "success" | "error"): void {
    this.hideToast();
    this.toastMessage = message;
    this.toastType = type;
    this.toastTimer = setTimeout(() => this.hideToast(), 5200);
  }
}
