import { CommonModule } from "@angular/common";
import { Component, Input, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import Swal from "sweetalert2";
import { AgentService } from "../../../services/agents/agent-service";

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

  isLoading = false;
  currentStep = 1;
  readonly totalSteps = 2;
  selectedPhoto?: File;
  photoPreview = "";
  createdAgent: any = null;

  private agentService = inject(AgentService);

  agentForm = new FormGroup({
    first_name: new FormControl("", [Validators.required]),
    last_name: new FormControl("", [Validators.required]),
    email: new FormControl("", [Validators.required, Validators.email]),
    phone_number: new FormControl("+243", [Validators.required]),
    address: new FormControl("", [Validators.required]),
    education_level: new FormControl(""),
    fonction: new FormControl("", [Validators.required]),
    matricule: new FormControl("", [Validators.required]),
    status: new FormControl("active"),
    contract_type: new FormControl("CDI"),
    shift: new FormControl("Jour"),
    hired_at: new FormControl(""),
    emergency_contact_name: new FormControl(""),
    emergency_contact_phone: new FormControl("+243"),
  });

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
      Swal.fire("Plan limite", this.limitMessage || "Votre plan ne permet pas de creer plus d'employes.", "warning");
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

        await Swal.fire({
          title: "Employé crée",
          text: "Le compte employé est prêt.",
          icon: "success",
          confirmButtonText: "Fermer",
          confirmButtonColor: "#ff7a1a"
        });

        window.location.reload();
      },
      error: (err) => {
        this.isLoading = false;
        const emailError = err.error?.errors?.email?.[0];
        const matriculeError = err.error?.errors?.matricule?.[0];
        const message = emailError
          ? emailError
          : matriculeError
            ? "Ce matricule existe deja. Saisissez un matricule unique."
            : err.error?.message || "Erreur lors de la creation de l'employe.";
        Swal.fire({
          title: "Creation impossible",
          text: message,
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "Réessayer"
        });
      }
    });
  }

  validateStep(step: number): boolean {
    const controlsByStep: Record<number, string[]> = {
      1: ["first_name", "last_name", "email", "phone_number", "address"],
      2: ["fonction", "matricule"],
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
}
