import {Component, inject, Input, signal} from "@angular/core";
import {CategoryService} from "../../../services/category/category-service";
import Swal from "sweetalert2";
import {DishService} from "../../../services/dish/dish-service";

@Component({
  selector: "app-delete-dish",
  imports: [],
  templateUrl: "./delete-dish.html",
  styleUrl: "./delete-dish.scss",
    standalone:true
})
export class DeleteDish {
    isLoading = false;
    dish = signal<any[]>([]);
    @Input() dishId: string | null = null;
    private dishService = inject(DishService);

    constructor() {
    }

    onDelete(id: string) {
        this.isLoading = true;
        this.dishService.delete(id).subscribe({
            next: (res) => {
                this.isLoading = false;
                this.dish.update(dish => dish.filter(c => c.id !== id));
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
