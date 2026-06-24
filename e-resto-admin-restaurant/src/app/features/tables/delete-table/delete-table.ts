import {Component, Input, signal} from "@angular/core";
import {CategoryService} from "../../../services/category/category-service";
import Swal from "sweetalert2";
import {TableService} from "../../../services/table/table-service";

@Component({
  selector: "app-delete-table",
  imports: [],
  templateUrl: "./delete-table.html",
  styleUrl: "./delete-table.scss",
    standalone: true,
})
export class DeleteTable {
    isLoading=false;
    tables = signal<any[]>([]);
    @Input() tableId: string | number | null = null;

    constructor(private tableService: TableService) {}

    onDelete(id: string | number) {
        this.isLoading=true;
        this.tableService.delete(id).subscribe({
            next: (res) => {
                this.isLoading=false;
                this.tables.update(table => table.filter(c => c.id !== id));
                window.location.reload();

            },
            error: (err) => {
                this.isLoading = false;
                Swal.fire({
                    title: 'Erreur',
                    text: err.error?.message || 'Erreur lors de la suppression.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Réessayer'
                });

            }
        });
    }

}
