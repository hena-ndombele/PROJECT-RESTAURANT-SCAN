import { Component, inject, OnInit, signal } from "@angular/core";
import { Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from "@angular/forms";
import { DishService } from "../../../services/dish/dish-service";
import { CategoryService } from "../../../services/category/category-service";
import { CategoryDto } from "../../../models/category/CategoryDto";

@Component({
    selector: "app-create-dish",
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: "./create-dish.html",
    styleUrl: "./create-dish.scss",
})
export class CreateDish implements OnInit {
    // Formulaire et état
    dishForm!: FormGroup;
    ingredients: string[] = [];
    isLoading = signal<boolean>(false);

    // Fichiers (Blob) pour l'envoi FormData
    selectedFile: File | null = null;
    thumb1File: File | null = null;
    thumb2File: File | null = null;

    // URLs pour l'affichage immédiat (Previews)
    previewUrl: string | null = null;
    thumb1Preview: string | null = null;
    thumb2Preview: string | null = null;

    // Injection des services
    private categoryService = inject(CategoryService);
    private dishService = inject(DishService);
    private fb = inject(FormBuilder);
    private router = inject(Router);

    // Signal pour les catégories (E-Resto Admin)
    categories = signal<CategoryDto[]>([]);

    ngOnInit(): void {
        this.dishForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(3)]],
            description: ['', [Validators.required, Validators.minLength(10)]],
            price: [0, [Validators.required, Validators.min(0)]],
            currency: ['CDF', Validators.required],
            category_id: ['', Validators.required],
            preparation_time: [30, [Validators.required, Validators.min(1)]],
            is_available: [true]
        });

        this.loadCategories();
    }

    loadCategories(): void {
        this.categoryService.list().subscribe({
            next: (data) => this.categories.set(data),
            error: (err) => console.error("Erreur chargement catégories", err)
        });
    }

    onFileChange(event: any, type: string): void {
        const file = event.target.files[0];
        if (!file) return;

        // 1. Assigner le fichier pour la validation immédiate
        if (type === 'main') this.selectedFile = file;
        else if (type === 'thumb1') this.thumb1File = file;
        else if (type === 'thumb2') this.thumb2File = file;

        // 2. Générer l'aperçu visuel sans attendre
        const reader = new FileReader();
        reader.onload = (e: any) => {
            const result = e.target.result;
            if (type === 'main') this.previewUrl = result;
            else if (type === 'thumb1') this.thumb1Preview = result;
            else if (type === 'thumb2') this.thumb2Preview = result;
        };
        reader.readAsDataURL(file);
    }

    addIngredient(event: any): void {
        const input = event.target as HTMLInputElement;
        const value = input.value.trim();
        if (value && !this.ingredients.includes(value)) {
            this.ingredients.push(value);
            input.value = '';
        }
        event.preventDefault();
    }

    removeIngredient(index: number): void {
        this.ingredients.splice(index, 1);
    }

    onSubmit(): void {
        if (this.dishForm.valid && this.selectedFile) {
            this.isLoading.set(true);

            const formData = new FormData();
            const formValue = this.dishForm.value;

            // Mapping des données textuelles
            formData.append('name', formValue.name);
            formData.append('description', formValue.description);
            formData.append('price', formValue.price.toString());
            formData.append('currency', formValue.currency);
            formData.append('category_id', formValue.category_id);
            formData.append('preparation_time', formValue.preparation_time.toString());
            formData.append('is_available', formValue.is_available ? '1' : '0');

            // Ingrédients
            this.ingredients.forEach(ing => formData.append('ingredients[]', ing));

            // Fichiers (Clés synchronisées avec Laravel)
            formData.append('image_principale', this.selectedFile);
            if (this.thumb1File) formData.append('image_secondaire_1', this.thumb1File);
            if (this.thumb2File) formData.append('image_secondaire_2', this.thumb2File);

            this.dishService.create(formData).subscribe({
                next: () => {
                    this.isLoading.set(false);
                    this.router.navigate(['/dish/list-dish']);
                },
                error: (err) => {
                    this.isLoading.set(false);
                    if (err.status === 422) {
                        alert("Erreur validation : " + JSON.stringify(err.error.errors));
                    } else {
                        alert("Une erreur est survenue lors de la création.");
                    }
                }
            });
        }
    }
}