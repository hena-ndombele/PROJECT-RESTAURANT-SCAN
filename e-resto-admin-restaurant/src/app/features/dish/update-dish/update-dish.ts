import { CommonModule } from "@angular/common";
import { Component, inject, OnInit, signal } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import Swal from "sweetalert2";
import { CategoryDto } from "../../../models/category/CategoryDto";
import { DishDto } from "../../../models/dish/DishDto";
import { CategoryService } from "../../../services/category/category-service";
import { DishService } from "../../../services/dish/dish-service";
import { STORAGE_ROOT } from "../../../services/api-url";

@Component({
    selector: "app-update-dish",
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: "./update-dish.html",
    styleUrl: "./update-dish.scss",
})
export class UpdateDish implements OnInit {
    dishForm!: FormGroup;
    ingredients: string[] = [];
    categories = signal<CategoryDto[]>([]);
    isLoading = signal<boolean>(false);
    isLoadingDish = signal<boolean>(true);
    errorMessage = "";

    dishId: string | null = null;
    dishDetail?: DishDto;

    selectedFile: File | null = null;
    thumb1File: File | null = null;
    thumb2File: File | null = null;

    previewUrl: string | null = null;
    thumb1Preview: string | null = null;
    thumb2Preview: string | null = null;

    readonly IMAGE_URL = `${STORAGE_ROOT}/`;

    private fb = inject(FormBuilder);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private dishService = inject(DishService);
    private categoryService = inject(CategoryService);

    ngOnInit(): void {
        this.dishId = this.route.snapshot.paramMap.get("id");
        this.buildForm();
        this.loadCategories();

        if (!this.dishId) {
            this.errorMessage = "Aucun plat selectionne.";
            this.isLoadingDish.set(false);
            return;
        }

        this.loadDish(this.dishId);
    }

    buildForm(): void {
        this.dishForm = this.fb.group({
            name: ["", [Validators.required, Validators.minLength(3)]],
            description: ["", [Validators.required, Validators.minLength(10)]],
            price: [0, [Validators.required, Validators.min(0)]],
            currency: ["CDF", Validators.required],
            category_id: ["", Validators.required],
            preparation_time: [30, [Validators.required, Validators.min(1)]],
            is_available: [true],
        });
    }

    loadCategories(): void {
        this.categoryService.list().subscribe({
            next: (data) => this.categories.set(data),
            error: (err) => console.error("Erreur chargement categories", err),
        });
    }

    loadDish(id: string): void {
        this.isLoadingDish.set(true);
        this.errorMessage = "";

        this.dishService.show(id).subscribe({
            next: (dish) => {
                this.dishDetail = dish;
                this.ingredients = this.normalizeIngredients(dish.ingredients);
                this.previewUrl = this.toStorageUrl(dish.image);
                this.thumb1Preview = this.toStorageUrl(dish.image_secondaire_1);
                this.thumb2Preview = this.toStorageUrl(dish.image_secondaire_2);

                this.dishForm.patchValue({
                    name: dish.name,
                    description: dish.description,
                    price: dish.price,
                    currency: dish.currency,
                    category_id: dish.category_id,
                    preparation_time: dish.preparation_time,
                    is_available: dish.is_available === true || dish.is_available === 1,
                });
            },
            error: (err) => {
                console.error("Erreur chargement plat", err);
                this.errorMessage = err.name === "TimeoutError"
                    ? "Le serveur ne repond pas pour ce plat."
                    : "Impossible de charger le plat.";
            },
        }).add(() => {
            this.isLoadingDish.set(false);
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
            const preview = reader.result as string;
            if (type === "main") this.previewUrl = preview;
            if (type === "thumb1") this.thumb1Preview = preview;
            if (type === "thumb2") this.thumb2Preview = preview;
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

    onSubmit(): void {
        if (!this.dishId || this.dishForm.invalid) {
            this.dishForm.markAllAsTouched();
            return;
        }

        this.isLoading.set(true);
        this.dishService.update(this.dishId, this.buildFormData()).subscribe({
            next: () => {
                this.isLoading.set(false);
                Swal.fire({
                    title: "Updated!",
                    text: "Dish updated successfully",
                    icon: "success",
                    timer: 2000,
                    confirmButtonColor: "#28a745",
                }).then(() => this.router.navigate(["/dish/list-dish"]));
            },
            error: (err) => {
                this.isLoading.set(false);
                Swal.fire({
                    title: "Error",
                    text: err.error?.message || "Error while updating dish",
                    icon: "error",
                    confirmButtonColor: "#d33",
                });
            },
        });
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

        this.ingredients.forEach((ingredient) => {
            formData.append("ingredients[]", ingredient);
        });

        if (this.selectedFile) formData.append("image_principale", this.selectedFile);
        if (this.thumb1File) formData.append("image_secondaire_1", this.thumb1File);
        if (this.thumb2File) formData.append("image_secondaire_2", this.thumb2File);

        return formData;
    }

    private normalizeIngredients(value: unknown): string[] {
        if (Array.isArray(value)) return value;
        if (typeof value !== "string" || !value.trim()) return [];

        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            return value.split(",").map((item) => item.trim()).filter(Boolean);
        }

        return [];
    }

    private toStorageUrl(path?: string | null): string | null {
        if (!path) return null;
        if (path.startsWith("http")) return path;
        return `${this.IMAGE_URL}${path}`;
    }
}
