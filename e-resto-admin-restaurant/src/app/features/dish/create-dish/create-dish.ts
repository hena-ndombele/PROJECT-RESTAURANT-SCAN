import { CommonModule } from "@angular/common";
import { Component, OnInit, inject, signal } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { CategoryDto } from "../../../models/category/CategoryDto";
import { CategoryService } from "../../../services/category/category-service";
import { DishService } from "../../../services/dish/dish-service";
import { SaasService } from "../../../services/saas/saas-service";

@Component({
    selector: "app-create-dish",
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: "./create-dish.html",
    styleUrl: "./create-dish.scss",
})
export class CreateDish implements OnInit {
    dishForm!: FormGroup;
    ingredients: string[] = [];
    selectedSizes: string[] = [];
    readonly sizeOptions = [
        { value: "small", label: "Petit" },
        { value: "medium", label: "Moyen" },
        { value: "large", label: "Grand" },
    ];
    isLoading = signal<boolean>(false);
    submitAttempted = signal<boolean>(false);
    formError = signal<string>("");
    canUseDishPromotions = signal<boolean>(false);

    selectedFile: File | null = null;
    thumb1File: File | null = null;
    thumb2File: File | null = null;

    previewUrl: string | null = null;
    thumb1Preview: string | null = null;
    thumb2Preview: string | null = null;

    categories = signal<CategoryDto[]>([]);

    private categoryService = inject(CategoryService);
    private dishService = inject(DishService);
    private saasService = inject(SaasService);
    private fb = inject(FormBuilder);
    private router = inject(Router);

    ngOnInit(): void {
        this.dishForm = this.fb.group({
            name: ["", [Validators.required, Validators.minLength(3)]],
            description: ["", [Validators.required, Validators.minLength(10)]],
            price: [0, [Validators.required, Validators.min(0)]],
            currency: ["CDF", Validators.required],
            category_id: ["", Validators.required],
            preparation_time: [30, [Validators.required, Validators.min(1)]],
            is_available: [true],
            promotion_enabled: [false],
            promotion_percent: [null, [Validators.min(1), Validators.max(95)]],
            promotion_ends_at: [""],
        });

        this.loadCategories();
        this.loadPlanUsage();
    }

    loadPlanUsage(): void {
        this.saasService.restaurantUsage().subscribe({
            next: (usage) => this.canUseDishPromotions.set(!!usage.permissions?.can_use_dish_promotions),
            error: () => this.canUseDishPromotions.set(false),
        });
    }

    loadCategories(): void {
        this.categoryService.list().subscribe({
            next: (data) => {
                this.categories.set(data);
            },
            error: (err) => {
                this.formError.set("Impossible de charger les catégories de ce restaurant. Reconnectez-vous puis réessayez.");
            },
        });
    }

    onFileChange(event: Event, type: "main" | "thumb1" | "thumb2"): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (type === "main") this.selectedFile = file;
        if (type === "thumb1") this.thumb1File = file;
        if (type === "thumb2") this.thumb2File = file;

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            if (type === "main") this.previewUrl = result;
            if (type === "thumb1") this.thumb1Preview = result;
            if (type === "thumb2") this.thumb2Preview = result;
        };
        reader.readAsDataURL(file);
    }

    addIngredient(event: Event): void {
        event.preventDefault();
        const input = event.target as HTMLInputElement;
        const value = input.value.trim();

        if (value && !this.ingredients.includes(value)) {
            this.ingredients.push(value);
            input.value = "";
        }
    }

    removeIngredient(index: number): void {
        this.ingredients.splice(index, 1);
    }

    toggleSize(size: string, checked: boolean): void {
        this.selectedSizes = checked ? [size] : [];
    }

    hasSize(size: string): boolean {
        return this.selectedSizes.includes(size);
    }

    onSubmit(): void {
        this.submitAttempted.set(true);
        this.formError.set("");

        if (!this.categories().length) {
            this.formError.set("Créez d'abord une catégorie avant d'ajouter un plat.");
            return;
        }

        if (this.dishForm.invalid) {
            this.dishForm.markAllAsTouched();
            this.formError.set("Completez les champs obligatoires avant de publier le plat.");
            return;
        }

        if (!this.selectedFile) {
            this.formError.set("Ajoutez une image principale pour ce plat.");
            return;
        }

        this.isLoading.set(true);
        this.dishService.create(this.buildFormData()).subscribe({
            next: () => {
                this.isLoading.set(false);
                this.router.navigate(["/dish/list-dish"]);
            },
            error: (err) => {
                this.isLoading.set(false);
                if (err.status === 422) {
                    this.formError.set("Erreur validation : " + JSON.stringify(err.error.errors));
                    return;
                }
                this.formError.set(err.error?.message || "Une erreur est survenue lors de la creation du plat.");
            },
        });
    }

    resetForm(): void {
        this.dishForm.reset({
            name: "",
            description: "",
            price: 0,
            currency: "CDF",
            category_id: "",
            preparation_time: 30,
            is_available: true,
            promotion_enabled: false,
            promotion_percent: null,
            promotion_ends_at: "",
        });
        this.ingredients = [];
        this.selectedSizes = [];
        this.selectedFile = null;
        this.thumb1File = null;
        this.thumb2File = null;
        this.previewUrl = null;
        this.thumb1Preview = null;
        this.thumb2Preview = null;
        this.submitAttempted.set(false);
        this.formError.set("");
    }

    private buildFormData(): FormData {
        const formValue = this.dishForm.value;
        const formData = new FormData();

        formData.append("name", formValue.name);
        formData.append("description", formValue.description);
        formData.append("price", formValue.price.toString());
        formData.append("currency", formValue.currency);
        formData.append("category_id", formValue.category_id);
        formData.append("preparation_time", formValue.preparation_time.toString());
        formData.append("is_available", formValue.is_available ? "1" : "0");

        if (this.canUseDishPromotions() && formValue.promotion_enabled) {
            if (formValue.promotion_percent) formData.append("promotion_percent", formValue.promotion_percent.toString());
            if (formValue.promotion_ends_at) formData.append("promotion_ends_at", formValue.promotion_ends_at);
        }

        this.ingredients.forEach((ingredient) => formData.append("ingredients[]", ingredient));
        this.selectedSizes.forEach((size) => formData.append("sizes[]", size));

        if (this.selectedFile) formData.append("image_principale", this.selectedFile);
        if (this.thumb1File) formData.append("image_secondaire_1", this.thumb1File);
        if (this.thumb2File) formData.append("image_secondaire_2", this.thumb2File);

        return formData;
    }
}
