import {Component, signal} from "@angular/core";
import {CategoryService} from "../../../services/category/category-service";
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import Swal from 'sweetalert2';

@Component({
  selector: "app-create-category",
    imports: [
        ReactiveFormsModule
    ],
  templateUrl: "./create-category.html",
  styleUrl: "./create-category.scss",
  standalone:true
})
export class CreateCategory {

  isLoading=false;
  name = signal('');
  description = signal('');
  selectedFile: File | null = null;

  constructor(private categoryService: CategoryService) {}

  categoryForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
  });

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }
  onSubmit() {

    if (this.categoryForm.valid && this.selectedFile) {
      const formData = new FormData();
      formData.append('name', this.categoryForm.value.name!);
      formData.append('description', this.categoryForm.value.description!);
      formData.append('image', this.selectedFile);
      this.createCategory(formData);

    } else {
      this.categoryForm.markAllAsTouched();

    }
  }

  createCategory(data: FormData) {
    this.isLoading = true;
    this.categoryService.create(data).subscribe({
      next: (response) => {
        this.isLoading = false;
        Swal.fire({
          title: 'Success !',
          text: 'A category has been added.',
          icon: 'success',
          confirmButtonText: 'Fermer',
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
          title: 'Erreur',
          text: err.error?.message || "Erreur lors de la création des catégories.",
          icon: 'error',
          confirmButtonColor: '#d33',
          confirmButtonText: 'Réessayer'
        });

      }

    });
  }

}
