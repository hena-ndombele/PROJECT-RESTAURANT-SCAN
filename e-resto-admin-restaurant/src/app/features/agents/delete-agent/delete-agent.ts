import {Component, Input, signal} from "@angular/core";
import {CategoryService} from "../../../services/category/category-service";
import Swal from "sweetalert2";
import {AgentService} from "../../../services/agents/agent-service";

@Component({
  selector: "app-delete-agent",
  imports: [],
  templateUrl: "./delete-agent.html",
  styleUrl: "./delete-agent.scss",
  standalone:true
})
export class DeleteAgent {
  isLoading = false;
  agents = signal<any[]>([]);
  @Input() agentId: string | null = null;


  constructor(private agentService: AgentService) {
  }

  onDelete(id: string) {
    this.isLoading = true;
    this.agentService.delete(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.agents.update(cats => cats.filter(c => c.id !== id));
        window.location.reload();

      },
      error: (err) => {
        this.isLoading = false;
        Swal.fire({
          title: 'Erreur',
          text: err.error?.message || 'Erreur lors de la suppression.',
          icon: 'error',
          confirmButtonColor: '#d33',
          confirmButtonText: 'Réessayer'
        });

      }
    });
  }

}
