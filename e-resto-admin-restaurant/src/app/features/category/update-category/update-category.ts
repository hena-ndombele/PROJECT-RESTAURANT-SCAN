import { Component, inject, Input, OnInit } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { CategoryService } from "../../../services/category/category-service";
import Swal from 'sweetalert2';
import { CategoryDto } from "../../../models/category/CategoryDto";
import { CategoryInput } from "../../../models/category/CategoryInput";
import { STORAGE_ROOT } from "../../../services/api-url";

@Component({
    selector: "app-update-category",
    imports: [ReactiveFormsModule],
    templateUrl: "./update-category.html",
    styleUrl: "./update-category.scss",
    standalone: true
})
export class UpdateCategory implements OnInit {
    @Input() categoryId: string | null = null;

    categoryDetail?: CategoryDto;
    imagePreview: string | ArrayBuffer | null = null;

    // Cette variable stocke l'objet File réel pour correspondre à CategoryInput
    selectedFile: File | null = null;
    isLoading = false;

    readonly IMAGE_URL = `${STORAGE_ROOT}/`;

    categoryForm = new FormGroup({
        name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    });

    private categoryService = inject(CategoryService);

    ngOnInit() {
        if (this.categoryId) {
            this.loadCategoryData(this.categoryId);
        }
    }

    loadCategoryData(id: string) {
        this.categoryService.show(id).subscribe({
            next: (data) => {
                this.categoryDetail = data;
                this.categoryForm.patchValue({
                    name: data.name,
                    description: data.description,
                });
            },
            error: (err) => console.error("Erreur lors du chargement", err)
        });
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            this.selectedFile = file; // On assigne le fichier brut ici

            // On génère l'aperçu visuel uniquement
            const reader = new FileReader();
            reader.onload = () => {
                this.imagePreview = reader.result;
            };
            reader.readAsDataURL(file);
        }
    }

    onSubmit() {
        if (this.categoryForm.valid && this.categoryDetail) {
            this.isLoading = true;

            // On construit l'objet selon votre modèle CategoryInput
            const categoryData: CategoryInput = {
                name: this.categoryForm.get('name')?.value || '',
                description: this.categoryForm.get('description')?.value || '',
                image: this.selectedFile // C'est maintenant un type File | null
            };

            this.updateCategory(categoryData);
        } else {
            this.categoryForm.markAllAsTouched();
        }
    }

    updateCategory(data: CategoryInput) {
        // Note : Votre service doit utiliser FormData pour envoyer le fichier à Laravel
        this.categoryService.update(this.categoryDetail!.id, data).subscribe({
            next: (response) => {
                this.isLoading = false;
                Swal.fire({
                    title: 'Updated!',
                    text: 'Category updated successfully',
                    icon: 'success',
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
                    text: err.error?.message || 'Error while editing categories',
                    icon: 'error',
                    confirmButtonColor: '#d33'
                });
            }
        });
    }
}
