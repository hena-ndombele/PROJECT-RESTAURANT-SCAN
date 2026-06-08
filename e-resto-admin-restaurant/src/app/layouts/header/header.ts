import { Component } from "@angular/core";

@Component({
  selector: "app-header",
  imports: [],
  templateUrl: "./header.html",
  styleUrl: "./header.scss",
})
export class Header {
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
