import { Component } from "@angular/core";
import {RouterLink, RouterLinkActive} from "@angular/router";

@Component({
  selector: "app-sidebare",
    imports: [
        RouterLink,
        RouterLinkActive
    ],
  templateUrl: "./sidebare.html",
  styleUrl: "./sidebare.scss",
})
export class Sidebare {
    protected isSidebarCollapsed = false;
    protected isMobileSidebarOpen = false;

    protected toggleSidebar(): void {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    protected openMobileSidebar(): void {
        this.isMobileSidebarOpen = true;
    }

    protected closeMobileSidebar(): void {
        this.isMobileSidebarOpen = false;
    }
}
