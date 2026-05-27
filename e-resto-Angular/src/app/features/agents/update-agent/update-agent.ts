import {Component, inject, Input, OnInit} from "@angular/core";
import {CategoryDto} from "../../../models/category/CategoryDto";
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import Swal from "sweetalert2";
import {AgentDto} from "../../../models/agents/AgentDto";
import {AgentService} from "../../../services/agents/agent-service";

@Component({
  selector: "app-update-agent",
    imports: [
        FormsModule,
        ReactiveFormsModule
    ],
  templateUrl: "./update-agent.html",
  styleUrl: "./update-agent.scss",
    standalone:true
})
export class UpdateAgent implements OnInit {
    @Input() agentId: string | null = null;
    agentDetail?: AgentDto;
    @Input() agent: CategoryDto | null = null;

    isLoading = false;

    agentForm = new FormGroup({
        first_name: new FormControl('', [Validators.required]),
        last_name: new FormControl('', [Validators.required]),
        email: new FormControl('', [Validators.required]),
        phone_number: new FormControl('', [Validators.required]),
        address: new FormControl('', [Validators.required]),
        education_level: new FormControl(''),
        fonction: new FormControl('', [Validators.required]),
    });

    private agentService=inject(AgentService)

    constructor() {}

    ngOnInit() {
        if(this.agentId) {
            this.loadAgentData(this.agentId);
        }
    }

    loadAgentData(id:string) {
        this.agentService.show(id).subscribe(data => {
            this.agentDetail = data;
            this.agentForm.patchValue(
                {
                    first_name: this.agentDetail.first_name,
                    last_name: this.agentDetail.last_name,
                    email: this.agentDetail.email,
                    phone_number: this.agentDetail.phone_number,
                    address: this.agentDetail.address,
                    education_level: this.agentDetail.education_level,
                    fonction: this.agentDetail.fonction,
                }
            )
        })
    }


    onSubmit() {
        if (this.agentForm.valid) {
            this.isLoading = true;

            const agentData = this.agentForm.value as AgentInput;


            const formData = new FormData();
            formData.append('first_name', this.agentForm.get('first_name')?.value || '');
            formData.append('last_name', this.agentForm.get('last_name')?.value || '');
            formData.append('email', this.agentForm.get('email')?.value || '');
            formData.append('phone_number', this.agentForm.get('phone_number')?.value || '');
            formData.append('address', this.agentForm.get('address')?.value || '');
            formData.append('education_level', this.agentForm.get('education_level')?.value || '');
            formData.append('fonction', this.agentForm.get('fonction')?.value || '');
            formData.append('_method', 'PUT');

            this.updateCategory(agentData);
        } else {
            this.agentForm.markAllAsTouched();
        }
    }

    updateCategory(data: AgentInput) {
        this.agentService.update(this.agentDetail!.id, data).subscribe({
            next: (response) => {
                console.log("response ********",response);
                this.isLoading = false;
                Swal.fire({
                    title: 'Updated!',
                    text: 'Employee updated successfully',
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
                Swal.fire({
                    title: 'Error',
                    text: err.error?.message || '\n' +
                        '.Error while editing employee',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Try again'
                });
            }
        });
    }
}
