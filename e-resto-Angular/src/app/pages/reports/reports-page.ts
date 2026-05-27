import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import ApexCharts from 'apexcharts';

@Component({
  selector: 'app-reports-page',
  templateUrl: './reports-page.html'
})
export class ReportsPageComponent implements AfterViewInit, OnDestroy {
  private chart?: ApexCharts;
  protected showingBoth = true;
  private readonly salesThisYear = [42000, 53000, 48000, 61000, 72000, 69000, 74000, 82000, 78000, 86000, 91000, 97000];
  private readonly salesLastYear = [38000, 45000, 47000, 56000, 65000, 63000, 68000, 70000, 69000, 75000, 80000, 84000];

  ngAfterViewInit(): void {
    const element = document.querySelector<HTMLElement>('#salesChart');
    if (!element) {
      return;
    }

    this.chart = new ApexCharts(element, {
      chart: { id: 'sales-overview', type: 'area', height: 420, zoom: { enabled: false }, toolbar: { show: false } },
      colors: ['#E66239', '#198754'],
      stroke: { width: [3, 2.5], curve: 'smooth' },
      markers: { size: 4, hover: { sizeOffset: 2 } },
      series: [{ name: 'This Year', data: this.salesThisYear }, { name: 'Last Year', data: this.salesLastYear }],
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, inverseColors: false, opacityFrom: 0.45, opacityTo: 0.05, stops: [20, 60, 100] } },
      yaxis: { labels: { formatter: (value: number) => this.formatCurrency(value) }, title: { text: 'Sales (INR)' } },
      xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], tickPlacement: 'on' },
      tooltip: { shared: true, y: { formatter: (value: number) => this.formatCurrency(value) } },
      legend: { position: 'top', horizontalAlign: 'right' },
      responsive: [{ breakpoint: 640, options: { chart: { height: 340 }, legend: { position: 'bottom', horizontalAlign: 'center' } } }]
    });

    void this.chart.render();
  }

  ngOnDestroy(): void {
    void this.chart?.destroy();
  }

  protected randomizeData(): void {
    const randomValue = () => Math.round((Math.random() * 80 + 20) * 1000);
    void this.chart?.updateSeries([{ name: 'This Year', data: Array.from({ length: 12 }, randomValue) }, { name: 'Last Year', data: Array.from({ length: 12 }, randomValue) }]);
    this.showingBoth = true;
  }

  protected toggleComparison(): void {
    if (!this.chart) {
      return;
    }

    if (this.showingBoth) {
      void this.chart.updateSeries([{ name: 'This Year', data: this.salesThisYear }]);
    } else {
      void this.chart.updateSeries([{ name: 'This Year', data: this.salesThisYear }, { name: 'Last Year', data: this.salesLastYear }]);
    }

    this.showingBoth = !this.showingBoth;
  }

  protected comparisonButtonLabel(): string {
    return this.showingBoth ? 'Show This Year Only' : 'Show Comparison';
  }

  private formatCurrency(value: number): string {
    return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
}
