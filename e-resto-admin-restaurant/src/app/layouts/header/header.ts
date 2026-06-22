import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";

@Component({
  selector: "app-header",
  imports: [CommonModule],
  templateUrl: "./header.html",
  styleUrl: "./header.scss",
})
export class Header implements OnDestroy {
  protected isSidebarCollapsed = false;
  protected isMobileSidebarOpen = false;
  protected now = new Date();
  private clockTimer = setInterval(() => {
    this.now = new Date();
  }, 1000);

  ngOnDestroy(): void {
    clearInterval(this.clockTimer);
  }

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
