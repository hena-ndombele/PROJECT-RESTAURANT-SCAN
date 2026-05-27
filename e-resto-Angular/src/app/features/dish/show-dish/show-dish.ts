import { CommonModule, DecimalPipe } from "@angular/common";
import { Component, Input, OnInit, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { DishDto } from "../../../models/dish/DishDto";
import { DishService } from "../../../services/dish/dish-service";

@Component({
    selector: "app-show-dish",
    standalone: true,
    imports: [CommonModule, DecimalPipe],
    templateUrl: "./show-dish.html",
    styleUrl: "./show-dish.scss",
})
export class ShowDish implements OnInit {
    @Input() id: string | null = null;

    dishDetail = signal<DishDto | null>(null);
    isLoading = signal<boolean>(true);
    errorMessage = signal<string>("");

    constructor(
        private route: ActivatedRoute,
        private dishService: DishService
    ) {}

    ngOnInit() {
        this.route.paramMap.subscribe((params) => {
            const id = this.id ?? params.get("id");
            this.loadDish(id);
        });
    }

    private loadDish(id: string | null) {
        this.isLoading.set(true);
        this.errorMessage.set("");
        this.dishDetail.set(null);

        if (!id) {
            this.errorMessage.set("Aucun plat selectionne.");
            this.isLoading.set(false);
            return;
        }

        this.dishService.show(id).subscribe({
            next: (response) => {
                console.log("Reponse plat recue :", response);
                this.dishDetail.set({
                    ...response,
                    ingredients: this.normalizeIngredients(response.ingredients),
                });
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error("Erreur de recuperation :", err);
                this.errorMessage.set(err.name === "TimeoutError"
                    ? "Le serveur ne repond pas. Verifie l'endpoint API du detail du plat."
                    : "Impossible de charger les informations du plat.");
                this.isLoading.set(false);
            },
        });
    }

    imageUrl(path?: string | null): string | null {
        if (!path) return null;
        if (path.startsWith("http")) return path;
        return `http://localhost:8000/storage/${path}`;
    }

    private normalizeIngredients(value: string[] | string | undefined): string[] {
        if (Array.isArray(value)) return value;
        if (!value) return [];

        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            return value.split(",").map((item) => item.trim()).filter(Boolean);
        }

        return [];
    }
}
