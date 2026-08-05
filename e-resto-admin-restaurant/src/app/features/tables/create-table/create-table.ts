import { Component, Input, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { TableService } from "../../../services/table/table-service";
import Swal from "sweetalert2";
import { AgentDto } from "../../../models/agents/AgentDto";
import { AgentService } from "../../../services/agents/agent-service";

@Component({
    selector: "app-create-table",
    imports: [
        FormsModule,
        ReactiveFormsModule
    ],
    templateUrl: "./create-table.html",
    styleUrl: "./create-table.scss",
    standalone: true
})
export class CreateTable implements OnInit {
    @Input() disabled = false;
    @Input() limitMessage = "";

    isLoading = false;
    name = signal("");
    agents = signal<AgentDto[]>([]);
    selectedServerEmails = signal<string[]>([]);

    constructor(
        private tableService: TableService,
        private agentService: AgentService
    ) {}

    tableForm = new FormGroup({
        name: new FormControl("", [Validators.required]),
        capacity: new FormControl("", [Validators.required, Validators.min(1)]),
        assignment_mode: new FormControl("all", [Validators.required]),
    });

    ngOnInit(): void {
        this.agentService.list().subscribe({
            next: (response: any) => {
                const agents = Array.isArray(response)
                    ? response
                    : Array.isArray(response?.data)
                        ? response.data
                        : [];
                this.agents.set(agents.filter((agent: AgentDto) => !!agent.email));
            },
            error: () => this.agents.set([])
        });
    }

    toggleServer(email: string): void {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        if (!normalizedEmail) {
            return;
        }

        this.selectedServerEmails.update((emails) =>
            emails.includes(normalizedEmail)
                ? emails.filter((item) => item !== normalizedEmail)
                : [...emails, normalizedEmail]
        );
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

        this.selectedServerEmails.update((emails) => [...emails, normalizedEmail]);
    }

    removeServer(email: string): void {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        this.selectedServerEmails.update((emails) => emails.filter((item) => item !== normalizedEmail));
    }

    isServerSelected(email: string): boolean {
        return this.selectedServerEmails().includes(String(email || "").trim().toLowerCase());
    }

    availableAgents(): AgentDto[] {
        return this.agents().filter((agent) => !this.isServerSelected(agent.email));
    }

    agentLabel(email: string): string {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const agent = this.agents().find((item) => String(item.email || "").trim().toLowerCase() === normalizedEmail);
        const name = agent ? `${agent.first_name || ""} ${agent.last_name || ""}`.trim() : "";
        return name || normalizedEmail;
    }

    assignmentMode(): string {
        return this.tableForm.value.assignment_mode || "all";
    }

    onSubmit(): void {
        if (this.disabled) {
            Swal.fire({
                title: "Forfait atteint",
                text: this.limitMessage || "Votre forfait ne permet pas de créer plus de tables.",
                icon: "warning",
                confirmButtonColor: "#d33",
                confirmButtonText: "Compris"
            });
            return;
        }

        if (this.tableForm.invalid) {
            this.tableForm.markAllAsTouched();
            return;
        }

        if (this.assignmentMode() === "selected" && this.selectedServerEmails().length === 0) {
            Swal.fire({
                title: "Aucun employé sélectionné",
                text: "Sélectionnez au moins un employé ou choisissez Tous les employés.",
                icon: "warning",
                confirmButtonText: "Compris",
                confirmButtonColor: "#d33"
            });
            return;
        }

        const formattedName = (this.tableForm.value.name || "")
            .replace(/(\D+)(\d+)/g, "$1 $2")
            .replace(/\s+/g, " ")
            .toUpperCase()
            .trim();

        const payload = {
            name: formattedName,
            capacity: Number(this.tableForm.value.capacity),
            assignment_mode: this.assignmentMode(),
            assigned_server_emails: this.assignmentMode() === "selected" ? this.selectedServerEmails() : []
        };

        this.createTable(payload);
    }

    createTable(data: any): void {
        this.isLoading = true;
        this.tableService.create(data).subscribe({
            next: () => {
                this.isLoading = false;
                Swal.fire({
                    title: "Succès",
                    text: "La table a été créée avec succès.",
                    icon: "success",
                    confirmButtonText: "Fermer",
                    timer: 2000,
                    confirmButtonColor: "#28a745"
                }).then(() => window.location.reload());
            },
            error: (err) => {
                this.isLoading = false;
                const duplicateName = err.error?.errors?.name?.[0];
                Swal.fire({
                    title: "Erreur",
                    text: duplicateName || err.error?.message || "Erreur lors de la création.",
                    icon: "error",
                    confirmButtonColor: "#d33",
                    confirmButtonText: "Réessayer"
                });
            }
        });
    }
}
