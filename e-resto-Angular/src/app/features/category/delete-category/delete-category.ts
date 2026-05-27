import {Component, Input, signal} from "@angular/core";
import {CategoryService} from "../../../services/category/category-service";
import Swal from 'sweetalert2';
import {CommonModule} from "@angular/common";


@Component({
    selector: "app-delete-category",
    imports: [
        CommonModule
    ],
    templateUrl: "./delete-category.html",
    styleUrl: "./delete-category.scss",
    standalone: true
})
export class DeleteCategory {
    isLoading = false;
    categories = signal<any[]>([]);
    @Input() categoryId: string | null = null;

    constructor(private categoryService: CategoryService) {
    }

    onDelete(id: string) {
        this.isLoading = true;
        this.categoryService.delete(id).subscribe({
            next: (res) => {
                console.log("res***********", res);
                this.isLoading = false;
                this.categories.update(cats => cats.filter(c => c.id !== id));
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
