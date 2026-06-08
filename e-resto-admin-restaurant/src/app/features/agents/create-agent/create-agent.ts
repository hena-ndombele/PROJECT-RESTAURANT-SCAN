import {Component, inject, signal} from "@angular/core";
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import Swal from "sweetalert2";
import {AgentService} from "../../../services/agents/agent-service";

@Component({
  selector: "app-create-agent",
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: "./create-agent.html",
  styleUrl: "./create-agent.scss",
  standalone:true
})
export class CreateAgent {
  isLoading=false;
  private agentService=inject(AgentService);

  constructor() {}

  agentForm = new FormGroup({
    first_name: new FormControl('', [Validators.required]),
    last_name: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required]),
    phone_number: new FormControl('', [Validators.required]),
    address: new FormControl('', [Validators.required]),
    education_level: new FormControl(''),
    fonction: new FormControl('', [Validators.required]),
  });


  onSubmit() {
    if (this.agentForm.valid) {
      const agentData = this.agentForm.value as AgentInput;
      this.createAgent(agentData);
    }
  }

  createAgent(agentData: AgentInput) {
    this.isLoading = true;
    this.agentService.create(agentData).subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('agents créée avec succès:', response);
        Swal.fire({
          title: 'Success !',
          text: 'A employee has been added.',
          icon: 'success',
          confirmButtonText: 'Close',
          timerProgressBar: true,
          timer: 3000,
          confirmButtonColor: '#28a745'
        }).then(() => {
          window.location.reload();
        });
      },
      error: (err) => {
        this.isLoading = false;
        console.error(err);
        Swal.fire({
          title: 'Error',
          text: err.error?.message || '\n' +
              '.Error creating agent',
          icon: 'error',
          confirmButtonColor: '#d33',
          confirmButtonText: 'Try again'
        });
      }
    });
  }
}
