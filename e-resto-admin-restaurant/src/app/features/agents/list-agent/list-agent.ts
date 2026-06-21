import {Component, computed, inject, signal} from "@angular/core";
import {CreateAgent} from "../create-agent/create-agent";
import {AgentService} from "../../../services/agents/agent-service";
import {AgentDto} from "../../../models/agents/AgentDto";
import {DatePipe} from "@angular/common";
import {DeleteAgent} from "../delete-agent/delete-agent";
import {UpdateAgent} from "../update-agent/update-agent";
import {ShowAgent} from "../show-agent/show-agent";
import * as XLSX from 'xlsx';
import {AppPermissionService} from "../../../services/auth/permission-service";

@Component({
  selector: "app-list-agent",
  imports: [
    CreateAgent,
    DatePipe,
    DeleteAgent,
    UpdateAgent,
    ShowAgent,
  ],
  templateUrl: "./list-agent.html",
  styleUrl: "./list-agent.scss",
  standalone:true
})
export class ListAgent {
  private agentService = inject(AgentService);
  private permissions = inject(AppPermissionService);
  isLoading = signal<boolean>(true);

  // Signaux d'état
  agents = signal<AgentDto[]>([]);
  searchTerm = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = 10;

    totalEmployeeCount = computed(() => this.agents().length);

  // Calcul automatique de la liste filtrée et paginée
  filteredAgents = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const allData = this.agents();

    // 1. Filtrage dynamique
    const filtered = allData.filter(agent =>
        agent.first_name.toLowerCase().includes(term) ||
        (agent.last_name && agent.email.toLowerCase().includes(term))
    );

    // 2. Pagination
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return filtered.slice(startIndex, startIndex + this.pageSize);
  });

  // Calcul du nombre total de pages pour l'affichage
  totalPages = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const filteredCount = this.agents().filter(agent =>
        agent.first_name.toLowerCase().includes(term) ||
        (agent.last_name && agent.email.toLowerCase().includes(term))
    ).length;
    return Math.ceil(filteredCount / this.pageSize);
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  canAccess(permission: string): boolean {
    return this.permissions.has(permission);
  }

  pagesArray = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  loadCategories(): void {
    this.isLoading.set(true);
    this.agentService.list().subscribe({
      next: (response: any) => { // 'response' représente tout le JSON
        // Accédez à la propriété 'data' qui contient le tableau d'agents
        if (response && response.data) {
          this.agents.set(response.data);
        } else {
          this.agents.set([]); // Sécurité si la réponse est vide
        }

        this.isLoading.set(false);
        this.currentPage.set(1);
      },
      error: (err) => {
        this.isLoading.set(false);
      }
    });
  }

  // Action de recherche
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
    this.currentPage.set(1); // Toujours revenir à la page 1 quand on filtre
  }

  // Navigation entre les pages
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

    exportToExcel(): void {
        // 1. Définir les données à exporter (ici tous les agents)
        const dataToExport = this.agents().map(agent => ({
            'First Name': agent.first_name,
            'Last Name': agent.last_name,
            'Email': agent.email,
            'Phone': agent.phone_number,
            'Address': agent.address
        }));

        // 2. Créer une feuille de calcul (Worksheet)
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);

        // 3. Créer un classeur (Workbook)
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Agents');

        // 4. Générer le fichier et déclencher le téléchargement
        const fileName = `Export_Agents_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    }
}
