import {Component, inject, Input, OnInit} from "@angular/core";
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import Swal from "sweetalert2";
import {AgentDto} from "../../../models/agents/AgentDto";
import {AgentService} from "../../../services/agents/agent-service";

@Component({
  selector: "app-update-agent",
  imports: [ReactiveFormsModule],
  templateUrl: "./update-agent.html",
  styleUrl: "./update-agent.scss",
  standalone: true
})
export class UpdateAgent implements OnInit {
  @Input() agentId: string | null = null;
  agentDetail?: AgentDto;
  isLoading = false;
  selectedPhoto?: File;
  photoPreview = "";

  private agentService = inject(AgentService);

  agentForm = new FormGroup({
    first_name: new FormControl("", [Validators.required]),
    last_name: new FormControl("", [Validators.required]),
    email: new FormControl("", [Validators.required, Validators.email]),
    phone_number: new FormControl("", [Validators.required]),
    address: new FormControl("", [Validators.required]),
    education_level: new FormControl(""),
    fonction: new FormControl("", [Validators.required]),
    matricule: new FormControl(""),
    status: new FormControl("active"),
    contract_type: new FormControl("CDI"),
    shift: new FormControl("Jour"),
    hired_at: new FormControl(""),
    emergency_contact_name: new FormControl(""),
    emergency_contact_phone: new FormControl(""),
  });

  ngOnInit(): void {
    if (this.agentId) {
      this.loadAgentData(this.agentId);
    }
  }

  loadAgentData(id: string): void {
    this.agentService.show(id).subscribe((response: any) => {
      this.agentDetail = response?.agent ?? response;
      this.photoPreview = this.agentDetail?.photo_url || "";
      this.agentForm.patchValue({
        first_name: this.agentDetail?.first_name || "",
        last_name: this.agentDetail?.last_name || "",
        email: this.agentDetail?.email || "",
        phone_number: this.agentDetail?.phone_number || "",
        address: this.agentDetail?.address || "",
        education_level: this.agentDetail?.education_level || "",
        fonction: this.agentDetail?.fonction || "",
        matricule: this.agentDetail?.matricule || "",
        status: this.agentDetail?.status || "active",
        contract_type: this.agentDetail?.contract_type || "CDI",
        shift: this.agentDetail?.shift || "Jour",
        hired_at: this.agentDetail?.hired_at || "",
        emergency_contact_name: this.agentDetail?.emergency_contact_name || "",
        emergency_contact_phone: this.agentDetail?.emergency_contact_phone || "",
      });
    });
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedPhoto = file;
    const reader = new FileReader();
    reader.onload = () => this.photoPreview = String(reader.result || "");
    reader.readAsDataURL(file);
  }

  onSubmit(): void {
    if (this.agentForm.invalid || !this.agentDetail) {
      this.agentForm.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    Object.entries(this.agentForm.value).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        formData.append(key, String(value));
      }
    });
    if (this.selectedPhoto) {
      formData.append("photo", this.selectedPhoto);
    }

    this.isLoading = true;
    this.agentService.update(this.agentDetail.id, formData).subscribe({
      next: () => {
        this.isLoading = false;
        Swal.fire({
          title: "Mis a jour",
          text: "Employé mis à jour avec succès.",
          icon: "success",
          confirmButtonText: "Fermer",
          confirmButtonColor: "#ff7a1a",
          timer: 2500,
          timerProgressBar: true,
        }).then(() => window.location.reload());
      },
      error: (err) => {
        this.isLoading = false;
        const emailError = err.error?.errors?.email?.[0];
        Swal.fire("Erreur", emailError || err.error?.message || "Impossible de modifier l'employé.", "error");
      }
    });
  }
}
