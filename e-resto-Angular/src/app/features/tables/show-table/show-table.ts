import {Component, Input, OnInit} from "@angular/core";
import {TableDto} from "../../../models/table/TableDto";
import {TableService} from "../../../services/table/table-service";

@Component({
    selector: "app-show-table",
    imports: [],
    templateUrl: "./show-table.html",
    styleUrl: "./show-table.scss",
    standalone: true
})
export class ShowTable implements OnInit {
    @Input() table: TableDto | undefined;
    @Input() tableId: string | null = null;
    tableDetail!: TableDto;

    ngOnInit(): void {
        if (this.table) {
            this.tableDetail = this.table;
        }
    }

    printQRCode(): void {
        if (!this.tableDetail) return;

        // On récupère l'URL de base de votre site (ex: http://localhost:4200)
        const baseUrl = window.location.origin;
        const logoUrl = `${baseUrl}/assets/logo/e-resto-logo.png`;

        const windowPrint = window.open('', '', 'left=0,top=0,width=800,height=900');

        if (windowPrint) {
            windowPrint.document.write(`
<html>
<head>
  <title>QR Code - ${this.tableDetail.name}</title>
  <style>
    @page { size: auto; margin: 0mm; }
    body { 
      font-family: 'Arial Black', Gadget, sans-serif; 
      display: flex; justify-content: center; align-items: center; 
      height: 100vh; background-color: white; margin: 0;
    }
    /* IMPORTANT : Forcer l'impression des couleurs de fond */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    .print-container {
      background-color: #0d1b1a !important; 
      color: white !important;
      width: 450px; padding: 40px; border: 15px solid #0d1b1a;
      position: relative; text-align: center; box-sizing: border-box;
    }
    .print-container::before {
      content: ""; position: absolute;
      top: 10px; left: 10px; right: 10px; bottom: 10px;
      border: 3px solid #F9A11B;
    }
    .qr-wrapper {
      background: white !important; padding: 15px; display: inline-block;
      position: relative; margin-bottom: 25px; z-index: 1;
    }
    .main-qr { width: 300px; height: 300px; display: block; }
    
    .qr-center-logo {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 60px; height: 60px; background: white !important;
      padding: 5px; border-radius: 5px; border: 2px solid #F9A11B;
      display: flex; align-items: center; justify-content: center;
    }
    .qr-center-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
    
    .header-text { font-size: 30px; font-weight: 900; color: white !important; margin-bottom: 20px; }
    .footer-text { font-size: 18px; color: #F9A11B !important; font-weight: bold; }
    .table-name {
      background-color: #F9A11B !important; color: white !important;
      display: inline-block; padding: 10px 30px; margin-top: 15px;
      font-size: 24px; font-weight: 900; border: 2px solid black;
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="header-text">SCAN<br>ME</div>
    <div class="qr-wrapper">
      <img src="${this.tableDetail.qr_url}" class="main-qr">
      <div class="qr-center-logo">
        <img src="${logoUrl}" alt="Logo">
      </div>
    </div>
    <div class="footer-text">SCAN THE QR CODE TO ORDER</div>
    <div class="table-name">${this.tableDetail.name}</div>
  </div>

  <script>
    // On attend que TOUTES les images (QR + Logo) soient chargées avant de lancer l'impression
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 500); // Petit délai de sécurité
    };
  </script>
</body>
</html>
        `);
            windowPrint.document.close();
        }
    }
}
