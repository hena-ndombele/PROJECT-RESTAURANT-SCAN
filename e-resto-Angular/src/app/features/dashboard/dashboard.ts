import {AfterViewInit, Component, OnDestroy} from "@angular/core";
import ApexCharts from "apexcharts";
import {Footer} from "../../layouts/footer/footer";
import {TranslateModule} from "@ngx-translate/core";

@Component({
    selector: "app-dashboard",
    imports: [
        Footer, TranslateModule

    ],
    templateUrl: "./dashboard.html",
    styleUrl: "./dashboard.scss",
    standalone:true
})


export class Dashboard implements AfterViewInit, OnDestroy {
    private salesPurchaseChart?: ApexCharts;
    private customerChart?: ApexCharts;

    ngAfterViewInit(): void {
        this.renderSalesPurchaseChart();
        this.renderCustomerChart();
    }

    ngOnDestroy(): void {
        void this.salesPurchaseChart?.destroy();
        void this.customerChart?.destroy();
    }

    private renderSalesPurchaseChart(): void {
        const element = document.querySelector<HTMLElement>('#salesPurchaseChart');
        if (!element) {
            return;
        }

        this.salesPurchaseChart = new ApexCharts(element, {
            series: [
                {name: 'Sales', data: [44, 55, 57, 56, 61, 58, 63, 60, 66]},
                {name: 'Purchase', data: [76, 85, 101, 98, 87, 105, 91, 114, 94]}
            ],
            colors: ['#f7a085', '#E66239'],
            chart: {
                type: 'bar',
                height: 350,
                width: '100%',
                parentHeightOffset: 0,
                toolbar: {show: false}
            },
            grid: {
                show: true,
                borderColor: '#e2e8f0'
            },
            legend: {
                show: true,
                fontFamily: 'Poppins, serif',
                fontWeight: 500,
                markers: {
                    size: 5,
                    shape: 'square',
                    strokeWidth: 0,
                    offsetX: -2,
                    offsetY: 0
                }
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '85%',
                    borderRadius: 3,
                    borderRadiusApplication: 'end'
                }
            },
            dataLabels: {enabled: false},
            stroke: {
                show: false,
                width: 2,
                colors: ['transparent']
            },
            xaxis: {
                categories: ['28 Jan', '29 Jan', '30 Jan', '31 Jan', '1 Feb', '2 Feb', '3 Feb', '4 Feb', '5 Feb'],
                axisBorder: {show: false},
                axisTicks: {show: false}
            },
            yaxis: {
                labels: {
                    formatter(value: number) {
                        return `${value}k`;
                    }
                },
                title: {
                    text: '$ (thousands)'
                }
            },
            fill: {opacity: 1},
            tooltip: {
                y: {
                    formatter(value: number) {
                        return `$ ${value} thousands`;
                    }
                }
            }
        });

        void this.salesPurchaseChart.render();
    }

    private renderCustomerChart(): void {
        const element = document.querySelector<HTMLElement>('#customerChart');
        if (!element) {
            return;
        }

        this.customerChart = new ApexCharts(element, {
            series: [44, 55],
            chart: {
                height: 200,
                type: 'radialBar'
            },
            colors: ['#5BE49B', '#E66239'],
            plotOptions: {
                radialBar: {
                    dataLabels: {
                        name: {fontSize: '22px'},
                        value: {fontSize: '16px'},
                        total: {show: false}
                    },
                    hollow: {
                        margin: 3,
                        size: '40%',
                        background: 'transparent'
                    },
                    track: {
                        show: true,
                        background: '#f0f0f0',
                        strokeWidth: '45%',
                        opacity: 1,
                        margin: 5
                    }
                }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'dark',
                    type: 'vertical',
                    gradientToColors: ['#007867', '#FFD666', '#FFAC82'],
                    stops: [0, 100]
                }
            },
            stroke: {
                lineCap: 'round'
            },
            labels: ['First Time', 'Return']
        });

        void this.customerChart.render();
    }
}
