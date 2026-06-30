import {Component, Input, signal} from "@angular/core";
import {CategoryService} from "../../../services/category/category-service";
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import Swal from 'sweetalert2';
import { CategoryDto } from "../../../models/category/CategoryDto";

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

  @Input() existingCategories: CategoryDto[] = [];
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

  clearDuplicateNameError(): void {
    const control = this.categoryForm.get('name');
    if (!control?.hasError('duplicate')) {
      return;
    }

    const errors = { ...(control.errors || {}) };
    delete errors['duplicate'];
    control.setErrors(Object.keys(errors).length ? errors : null);
  }

  onSubmit() {
    this.clearDuplicateNameError();
    const nameControl = this.categoryForm.get('name');
    const normalizedName = this.normalizeCategoryName(nameControl?.value || '');

    if (normalizedName && this.categoryNameAlreadyExists(normalizedName)) {
      nameControl?.setErrors({ ...(nameControl.errors || {}), duplicate: true });
      nameControl?.markAsTouched();
      return;
    }

    if (this.categoryForm.valid && this.selectedFile) {
      const formData = new FormData();
      formData.append('name', String(this.categoryForm.value.name || '').trim());
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
          title: 'Succès !',
          text: 'Une catégorie a été ajoutée.',
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
        if (err.error?.errors?.name) {
          this.categoryForm.get('name')?.setErrors({ duplicate: true });
          this.categoryForm.get('name')?.markAsTouched();
        }
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

  private categoryNameAlreadyExists(normalizedName: string): boolean {
    return this.existingCategories.some((category) => this.normalizeCategoryName(category.name) === normalizedName);
  }

  private normalizeCategoryName(value: string): string {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

}
