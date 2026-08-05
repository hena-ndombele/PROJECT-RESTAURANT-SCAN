import { Component, Input, OnChanges, SimpleChanges, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import Swal from "sweetalert2";
import { AgentDto } from "../../../models/agents/AgentDto";
import { TableDto } from "../../../models/table/TableDto";
import { AgentService } from "../../../services/agents/agent-service";
import { TableService } from "../../../services/table/table-service";

@Component({
  selector: "app-update-table",
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: "./update-table.html",
  styleUrl: "./update-table.scss",
})
export class UpdateTable implements OnChanges {
  @Input() table: TableDto | null = null;
  private tableService = inject(TableService);
  private agentService = inject(AgentService);
  isLoading = false;
  agents: AgentDto[] = [];
  selectedServerEmails: string[] = [];

  tableForm = new FormGroup({
    name: new FormControl("", [Validators.required]),
    capacity: new FormControl("", [Validators.required, Validators.min(1)]),
    assignment_mode: new FormControl("all", [Validators.required]),
  });

  constructor() {
    this.agentService.list().subscribe({
      next: (response: any) => {
        const agents = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];
        this.agents = agents.filter((agent: AgentDto) => !!agent.email);
      },
      error: () => {
        this.agents = [];
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["table"] && this.table) {
      this.tableForm.patchValue({
        name: this.table.name || "",
        capacity: String(this.table.capacity || ""),
        assignment_mode: this.table.assignment_mode || "all",
      });
      this.selectedServerEmails = (this.table.assigned_server_emails || [])
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(Boolean);
    }
  }

  get modalId(): string {
    return `updateTableModal${this.table?.id || ""}`;
  }

  clearNameError(): void {
    const control = this.tableForm.get("name");
    if (!control?.hasError("duplicate")) {
      return;
    }

    const errors = { ...(control.errors || {}) };
    delete errors["duplicate"];
    control.setErrors(Object.keys(errors).length ? errors : null);
  }

  assignmentMode(): string {
    return this.tableForm.value.assignment_mode || "all";
  }

  toggleServer(email: string): void {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    this.selectedServerEmails = this.selectedServerEmails.includes(normalizedEmail)
      ? this.selectedServerEmails.filter((item) => item !== normalizedEmail)
      : [...this.selectedServerEmails, normalizedEmail];
  }

  addServerFromSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.addServer(select.value);
    select.value = "";
  }

  addServer(email: string): void {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || this.isServerSelected(normalizedEmail)) {
      return;
    }

    this.selectedServerEmails = [...this.selectedServerEmails, normalizedEmail];
  }

  removeServer(email: string): void {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    this.selectedServerEmails = this.selectedServerEmails.filter((item) => item !== normalizedEmail);
  }

  isServerSelected(email: string): boolean {
    return this.selectedServerEmails.includes(String(email || "").trim().toLowerCase());
  }

  availableAgents(): AgentDto[] {
    return this.agents.filter((agent) => !this.isServerSelected(agent.email));
  }

  agentLabel(email: string): string {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const agent = this.agents.find((item) => String(item.email || "").trim().toLowerCase() === normalizedEmail);
    const name = agent ? `${agent.first_name || ""} ${agent.last_name || ""}`.trim() : "";
    return name || normalizedEmail;
  }

  onSubmit(): void {
    if (!this.table?.id) {
      return;
    }

    if (this.tableForm.invalid) {
      this.tableForm.markAllAsTouched();
      return;
    }

    if (this.assignmentMode() === "selected" && this.selectedServerEmails.length === 0) {
      Swal.fire({
        title: "Aucun employé selectionné",
        text: "Selectionnez au moins un employé ou choisissez Tous les employés.",
        icon: "warning",
        confirmButtonText: "Compris",
        confirmButtonColor: "#d33",
      });
      return;
    }

    const payload = {
      name: this.formatTableName(this.tableForm.value.name || ""),
      capacity: Number(this.tableForm.value.capacity),
      assignment_mode: this.assignmentMode(),
      assigned_server_emails: this.assignmentMode() === "selected" ? this.selectedServerEmails : [],
    };

    this.isLoading = true;
    this.tableService.update(this.table.id, payload).subscribe({
      next: () => {
        this.isLoading = false;
        Swal.fire({
          title: "Table modifiée",
          text: "Les informations de la table ont été mises à jour.",
          icon: "success",
          confirmButtonText: "Fermer",
          timer: 2000,
          confirmButtonColor: "#28a745",
        }).then(() => window.location.reload());
      },
      error: (err) => {
        this.isLoading = false;
        const duplicateName = err.error?.errors?.name?.[0];
        if (duplicateName) {
          this.tableForm.get("name")?.setErrors({ duplicate: true });
          this.tableForm.get("name")?.markAsTouched();
        }

        Swal.fire({
          title: "Erreur",
          text: duplicateName || err.error?.message || "Impossible de modifier la table.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "Réessayer",
        });
      },
    });
  }

  private formatTableName(value: string): string {
    return String(value || "")
      .replace(/(\D+)(\d+)/g, "$1 $2")
      .replace(/\s+/g, " ")
      .toUpperCase()
      .trim();
  }
}
