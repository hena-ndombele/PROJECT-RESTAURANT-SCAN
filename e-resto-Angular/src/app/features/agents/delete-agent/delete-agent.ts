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
        console.log("res***********", res);
        this.isLoading = false;
        this.agents.update(cats => cats.filter(c => c.id !== id));
        console.log('Supprimée avec succès');
        window.location.reload();

      },
      error: (err) => {
        this.isLoading = false;
        Swal.fire({
          title: 'Error',
          text: err.error?.message || '\n' +
              'Error during deletion.',
          icon: 'error',
          confirmButtonColor: '#d33',
          confirmButtonText: 'Try again'
        });

      }
    });
  }

}
