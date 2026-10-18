// ============================================================
// GOOGLE APPS SCRIPT - KyFinance BOT
// Layout: Data (kiri A:J) | Grafik (kanan L:T) — 1x setup selamanya
// ============================================================

const SHEET_TX = "Transactions";
const SHEET_DASHBOARD = "Dashboard";
const SHEET_CHART_DATA = "ChartData";

// ============================================================
// MAIN ENDPOINT (Webhook dari Vercel/Telegram)
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_TX);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_TX);
      const headers = ["Tanggal", "Tipe", "Kategori", "Nominal", "Dari Akun", "Ke Akun", "Catatan", "Bulan-Tahun"];
      sheet.appendRow(headers);
      const hr = sheet.getRange(1, 1, 1, headers.length);
      hr.setBackground("#1a73e8").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    if (data.action === "APPEND") {
      const now = new Date();
      const dateStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      const monthYear = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM");
      sheet.appendRow([
        dateStr,
        data.tx.action,
        data.tx.category || "-",
        data.tx.amount,
        data.tx.from_account || "Cash",
        data.tx.to_account || "-",
        data.tx.note || "-",
        monthYear
      ]);
      sheet.getRange(sheet.getLastRow(), 4).setNumberFormat('"Rp"#,##0');
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "DELETE_LAST") {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const del = sheet.getRange(lastRow, 1, 1, 8).getValues()[0];
        sheet.deleteRow(lastRow);
        return ContentService.createTextOutput(JSON.stringify({ status: "success", deletedRow: del })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "empty" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "GET_DATA") {
      const rows = sheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", rows: rows })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}


// ============================================================
// SETUP DASHBOARD — Jalankan 1x dari editor Apps Script
// Setelah ini bot otomatis update tanpa perlu setup lagi!
// ============================================================
function setupDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── 1. Pastikan sheet Transactions ada ──
  let txSheet = ss.getSheetByName(SHEET_TX);
  if (!txSheet) {
    txSheet = ss.insertSheet(SHEET_TX);
    const headers = ["Tanggal", "Tipe", "Kategori", "Nominal", "Dari Akun", "Ke Akun", "Catatan", "Bulan-Tahun"];
    txSheet.appendRow(headers);
    txSheet.getRange(1, 1, 1, 8)
      .setBackground("#1a73e8").setFontColor("#ffffff")
      .setFontWeight("bold").setHorizontalAlignment("center");
    txSheet.setFrozenRows(1);
  }

  // ── 2. Buat/reset ChartData (pivot tersembunyi, auto-update) ──
  let cd = ss.getSheetByName(SHEET_CHART_DATA);
  if (cd) ss.deleteSheet(cd);
  cd = ss.insertSheet(SHEET_CHART_DATA);
  cd.hideSheet();

  // Pivot kategori pengeluaran
  cd.getRange("A1").setValue("Kategori");
  cd.getRange("B1").setValue("Total");
  cd.getRange("A2").setFormula(
    '=IFERROR(QUERY(Transactions!A2:H,"SELECT C, SUM(D) WHERE B=\'EXPENSE\' AND C<>\'-\' GROUP BY C ORDER BY SUM(D) DESC LABEL C\'\',SUM(D)\'\'",0),{"(belum ada)",0})'
  );

  // Pivot bulanan
  cd.getRange("D1").setValue("Bulan");
  cd.getRange("E1").setValue("Pengeluaran");
  cd.getRange("F1").setValue("Pemasukan");
  cd.getRange("D2").setFormula(
    '=IFERROR(QUERY(Transactions!A2:H,"SELECT H,SUM(D) WHERE B=\'EXPENSE\' AND H<>\'\' GROUP BY H ORDER BY H ASC LABEL H\'\',SUM(D)\'\'",0),{"(belum ada)",0})'
  );
  cd.getRange("F2").setFormula(
    '=IFERROR(QUERY(Transactions!A2:H,"SELECT SUM(D) WHERE B=\'INCOME\' AND H<>\'\' GROUP BY H ORDER BY H ASC LABEL SUM(D)\'\'",0),{0})'
  );

  // ── 3. Buat/reset Dashboard ──
  let dash = ss.getSheetByName(SHEET_DASHBOARD);
  if (dash) ss.deleteSheet(dash);
  dash = ss.insertSheet(SHEET_DASHBOARD, 0);
  dash.setTabColor("#0f9d58");

  // ── Lebar kolom ──
  // Panel KIRI: A-J (data)
  dash.setColumnWidth(1, 155);  // A - label
  dash.setColumnWidth(2, 145);  // B - nilai
  dash.setColumnWidth(3, 14);   // C - spacer
  dash.setColumnWidth(4, 105);  // D - bulan
  dash.setColumnWidth(5, 130);  // E - pengeluaran
  dash.setColumnWidth(6, 120);  // F - pemasukan
  dash.setColumnWidth(7, 14);   // G - spacer
  dash.setColumnWidth(8, 140);  // H - kategori
  dash.setColumnWidth(9, 110);  // I - total
  dash.setColumnWidth(10, 18);  // J - spacer/pembatas
  // Panel KANAN: K-T (grafik)
  dash.setColumnWidth(11, 14);  // K - margin kiri grafik
  dash.setColumnWidth(12, 395); // L - grafik 1 & 3 (donut + line)
  dash.setColumnWidth(13, 14);  // M - gap antar grafik
  dash.setColumnWidth(14, 395); // N - grafik 2 (bar)
  dash.setColumnWidth(15, 14);  // O - margin kanan

  // ── Tinggi baris ──
  dash.setRowHeight(1, 48);
  dash.setRowHeight(2, 22);
  dash.setRowHeight(3, 28);

  // ============================================================
  // HEADER UTAMA — A1:O1
  // ============================================================
  dash.getRange("A1:O1").merge()
    .setValue("📊  DASHBOARD KEUANGAN PRIBADI — KyFinance")
    .setBackground("#1a1a2e")
    .setFontColor("#e0e0e0")
    .setFontSize(15)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  dash.getRange("A2:J2").merge()
    .setValue("🤖  Auto-update tiap ada transaksi via @KyFinance_BOT · Setup 1x, pakai selamanya!")
    .setBackground("#16213e")
    .setFontColor("#7ecef4")
    .setFontSize(9)
    .setHorizontalAlignment("center");

  dash.getRange("K2:O2").merge()
    .setValue("📈  Visualisasi Otomatis")
    .setBackground("#16213e")
    .setFontColor("#7ecef4")
    .setFontSize(9)
    .setHorizontalAlignment("center");

  // ============================================================
  // PANEL KIRI — SALDO & ASET (A3:B8)
  // ============================================================
  dash.getRange("A3:B3").merge()
    .setValue("💵  SALDO & ASET")
    .setBackground("#1565c0")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  const aset = [
    ["🪙  Cash",
     '=SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*Cash*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*Cash*")'
     +'-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*Cash*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!F:F,"*Cash*")'
     +'-SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!E:E,"*Cash*")',
     "#e8f5e9", "#1b5e20"],

    ["📱  E-Wallet",
     '=SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*Gopay*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*OVO*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*Dana*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*Gopay*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*OVO*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*Dana*")'
     +'-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*Gopay*")'
     +'-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*OVO*")'
     +'-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*Dana*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!F:F,"*Gopay*")'
     +'-SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!E:E,"*Gopay*")',
     "#e3f2fd", "#0d47a1"],

    ["🏦  Bank",
     '=SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*BCA*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*SeaBank*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*Mandiri*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*BCA*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*SeaBank*")'
     +'-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*BCA*")'
     +'-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*SeaBank*")'
     +'-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*Mandiri*")'
     +'+SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!F:F,"*BCA*")'
     +'-SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!E:E,"*BCA*")',
     "#fff8e1", "#e65100"],

    ["📈  Investasi",
     '=SUMIFS(Transactions!D:D,Transactions!B:B,"INVEST")',
     "#fce4ec", "#880e4f"],
  ];

  aset.forEach(([label, formula, bg, fg], i) => {
    const r = 4 + i;
    dash.setRowHeight(r, 36);
    dash.getRange(r, 1).setValue(label)
      .setBackground(bg).setFontWeight("bold").setVerticalAlignment("middle");
    dash.getRange(r, 2).setFormula(formula)
      .setBackground(bg).setFontColor(fg).setFontWeight("bold").setFontSize(11)
      .setNumberFormat('"Rp"#,##0').setVerticalAlignment("middle").setHorizontalAlignment("right");
  });

  // Total Aset
  dash.setRowHeight(8, 40);
  dash.getRange("A8").setValue("🏆  TOTAL ASET")
    .setBackground("#1a1a2e").setFontColor("#7ecef4")
    .setFontWeight("bold").setFontSize(11).setVerticalAlignment("middle");
  dash.getRange("B8").setFormula("=SUM(B4:B7)")
    .setBackground("#1a1a2e").setFontColor("#ffd700")
    .setFontWeight("bold").setFontSize(13)
    .setNumberFormat('"Rp"#,##0').setVerticalAlignment("middle").setHorizontalAlignment("right");

  dash.getRange("A3:B8")
    .setBorder(true,true,true,true,true,true,"#5c7cfa",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Bulan ini
  dash.setRowHeight(9, 8);
  dash.setRowHeight(10, 36);
  dash.getRange("A10").setValue("📆  Bulan Ini · Keluar")
    .setBackground("#c62828").setFontColor("#fff").setFontWeight("bold").setVerticalAlignment("middle");
  dash.getRange("B10")
    .setFormula('=SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!H:H,TEXT(TODAY(),"yyyy-MM"))')
    .setBackground("#c62828").setFontColor("#fff").setFontWeight("bold").setFontSize(12)
    .setNumberFormat('"Rp"#,##0').setVerticalAlignment("middle").setHorizontalAlignment("right");

  dash.setRowHeight(11, 36);
  dash.getRange("A11").setValue("📆  Bulan Ini · Masuk")
    .setBackground("#2e7d32").setFontColor("#fff").setFontWeight("bold").setVerticalAlignment("middle");
  dash.getRange("B11")
    .setFormula('=SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!H:H,TEXT(TODAY(),"yyyy-MM"))')
    .setBackground("#2e7d32").setFontColor("#fff").setFontWeight("bold").setFontSize(12)
    .setNumberFormat('"Rp"#,##0').setVerticalAlignment("middle").setHorizontalAlignment("right");

  dash.getRange("A10:B11")
    .setBorder(true,true,true,true,true,true,"#9e9e9e",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // ============================================================
  // PANEL TENGAH — REKAP BULANAN (D3:F∞ — auto-grow ke bawah)
  // ============================================================
  dash.getRange("D3:F3").merge()
    .setValue("📅  REKAP PER BULAN")
    .setBackground("#b71c1c")
    .setFontColor("#fff").setFontWeight("bold").setFontSize(10)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");

  dash.getRange("D4").setValue("Bulan").setFontWeight("bold").setBackground("#ffcdd2").setHorizontalAlignment("center");
  dash.getRange("E4").setValue("💸 Keluar").setFontWeight("bold").setBackground("#ffcdd2").setHorizontalAlignment("center");
  dash.getRange("F4").setValue("💰 Masuk").setFontWeight("bold").setBackground("#ffcdd2").setHorizontalAlignment("center");
  dash.setRowHeight(4, 28);

  // QUERY otomatis — tambah bulan baru otomatis sendiri
  dash.getRange("D5").setFormula(
    '=IFERROR(QUERY(Transactions!A2:H,"SELECT H,SUM(D) WHERE B=\'EXPENSE\' AND H<>\'\' GROUP BY H ORDER BY H DESC LABEL H\'\',SUM(D)\'\'",0),{"Belum ada data",""})'
  );
  dash.getRange("F5").setFormula(
    '=IFERROR(QUERY(Transactions!A2:H,"SELECT SUM(D) WHERE B=\'INCOME\' AND H<>\'\' GROUP BY H ORDER BY H DESC LABEL SUM(D)\'\'",0),{""})'
  );
  dash.getRange("D3:F3")
    .setBorder(true,true,false,true,false,false,"#b71c1c",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  dash.getRange("D4:F30").setNumberFormat('@'); // format teks supaya bulan tidak diubah
  dash.getRange("E4:F30").setNumberFormat('"Rp"#,##0');

  // ============================================================
  // PANEL KANAN DATA — TOP KATEGORI (H3:I∞)
  // ============================================================
  dash.getRange("H3:I3").merge()
    .setValue("🏷️  TOP KATEGORI")
    .setBackground("#4a148c")
    .setFontColor("#fff").setFontWeight("bold").setFontSize(10)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");

  dash.getRange("H4").setValue("Kategori").setFontWeight("bold").setBackground("#e1bee7").setHorizontalAlignment("center");
  dash.getRange("I4").setValue("Total").setFontWeight("bold").setBackground("#e1bee7").setHorizontalAlignment("center");
  dash.setRowHeight(4, 28);

  // QUERY otomatis — auto sort terbesar
  dash.getRange("H5").setFormula(
    '=IFERROR(QUERY(Transactions!A2:H,"SELECT C,SUM(D) WHERE B=\'EXPENSE\' AND C<>\'-\' GROUP BY C ORDER BY SUM(D) DESC LIMIT 12 LABEL C\'\',SUM(D)\'\'",0),{"Belum ada data",0})'
  );
  dash.getRange("I5:I20").setNumberFormat('"Rp"#,##0');
  dash.getRange("H3:I3")
    .setBorder(true,true,false,true,false,false,"#4a148c",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // ============================================================
  // GRAFIK — Di sebelah KANAN panel data (kolom L & N, mulai row 3)
  // Grafik 1 (Donut) : row 3, col 12 (L)
  // Grafik 2 (Bar)   : row 3, col 14 (N)
  // Grafik 3 (Line)  : row 17, col 12 (L) — span lebar
  // ============================================================
  Utilities.sleep(1500); // beri waktu formula resolve

  // === GRAFIK 1: DONUT — Pengeluaran per Kategori ===
  const chartPie = dash.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(cd.getRange("A1:B13"))
    .setPosition(3, 12, 0, 0)          // row 3, kolom L
    .setOption("title", "Pengeluaran per Kategori")
    .setOption("titleTextStyle", {fontSize:11, bold:true, color:"#212121"})
    .setOption("pieHole", 0.45)
    .setOption("legend", {position:"right", textStyle:{fontSize:8}})
    .setOption("backgroundColor", "#fafafa")
    .setOption("chartArea", {left:15, top:38, width:"58%", height:"78%"})
    .setOption("colors", ["#4285f4","#ea4335","#fbbc04","#34a853","#ff6d00","#46bdc6","#7b1fa2","#e91e63","#0d47a1","#1b5e20","#f57f17","#37474f"])
    .setOption("width", 390)
    .setOption("height", 255)
    .build();
  dash.insertChart(chartPie);

  // === GRAFIK 2: COLUMN — Expense vs Income per Bulan ===
  const chartBar = dash.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(cd.getRange("D1:F1"))
    .addRange(cd.getRange("D2:F15"))
    .setPosition(3, 14, 0, 0)         // row 3, kolom N
    .setOption("title", "Keluar vs Masuk per Bulan")
    .setOption("titleTextStyle", {fontSize:11, bold:true, color:"#212121"})
    .setOption("legend", {position:"bottom", textStyle:{fontSize:8}})
    .setOption("backgroundColor", "#fafafa")
    .setOption("hAxis", {textStyle:{fontSize:7}, slantedText:true, slantedTextAngle:40})
    .setOption("vAxis", {format:"short", minValue:0, textStyle:{fontSize:8}})
    .setOption("colors", ["#e53935","#43a047"])
    .setOption("bar", {groupWidth:"60%"})
    .setOption("chartArea", {left:50, top:38, width:"74%", height:"66%"})
    .setOption("width", 390)
    .setOption("height", 255)
    .build();
  dash.insertChart(chartBar);

  // === GRAFIK 3: LINE — Tren Pengeluaran (lebar penuh, row 17) ===
  const chartLine = dash.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(cd.getRange("D1:E15"))
    .setPosition(17, 12, 0, 0)        // row 17, kolom L (lebih panjang)
    .setOption("title", "Tren Pengeluaran Bulanan")
    .setOption("titleTextStyle", {fontSize:11, bold:true, color:"#212121"})
    .setOption("legend", {position:"none"})
    .setOption("backgroundColor", "#fafafa")
    .setOption("hAxis", {textStyle:{fontSize:8}, slantedText:true, slantedTextAngle:40})
    .setOption("vAxis", {format:"short", minValue:0, textStyle:{fontSize:8}})
    .setOption("colors", ["#e53935"])
    .setOption("lineWidth", 3)
    .setOption("pointSize", 7)
    .setOption("curveType", "function")
    .setOption("chartArea", {left:55, top:38, width:"85%", height:"68%"})
    .setOption("width", 797)           // span 2 kolom grafik
    .setOption("height", 230)
    .build();
  dash.insertChart(chartLine);

  // ============================================================
  // FOOTER
  // ============================================================
  dash.getRange("A32:O32").merge()
    .setValue("⚡ KyFinance BOT · @KyFinance_BOT · Setup otomatis 1x — data & grafik update real-time tiap ada transaksi baru · "
              + Utilities.formatDate(new Date(), "Asia/Jakarta", "dd MMM yyyy HH:mm"))
    .setBackground("#1a1a2e")
    .setFontColor("#7ecef4")
    .setFontSize(8)
    .setHorizontalAlignment("center");

  SpreadsheetApp.flush();
  Logger.log("✅ Dashboard KyFinance siap! Setup 1x, pakai selamanya.");
}


// ============================================================
// REFRESH CHARTS ONLY — Jalankan jika grafik perlu di-refresh
// (tidak perlu setup ulang, data tetap aman)
// ============================================================
function refreshCharts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dash = ss.getSheetByName(SHEET_DASHBOARD);
  const cd = ss.getSheetByName(SHEET_CHART_DATA);

  if (!dash || !cd) {
    SpreadsheetApp.getUi().alert("❌ Jalankan setupDashboard() dulu sekali ya!");
    return;
  }

  dash.getCharts().forEach(c => dash.removeChart(c));
  Utilities.sleep(800);

  const chartPie = dash.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(cd.getRange("A1:B13"))
    .setPosition(3, 12, 0, 0)
    .setOption("title", "Pengeluaran per Kategori")
    .setOption("pieHole", 0.45)
    .setOption("legend", {position:"right", textStyle:{fontSize:8}})
    .setOption("backgroundColor", "#fafafa")
    .setOption("colors", ["#4285f4","#ea4335","#fbbc04","#34a853","#ff6d00","#46bdc6","#7b1fa2","#e91e63","#0d47a1","#1b5e20","#f57f17","#37474f"])
    .setOption("width", 390).setOption("height", 255)
    .build();
  dash.insertChart(chartPie);

  const chartBar = dash.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(cd.getRange("D1:F1"))
    .addRange(cd.getRange("D2:F15"))
    .setPosition(3, 14, 0, 0)
    .setOption("title", "Keluar vs Masuk per Bulan")
    .setOption("legend", {position:"bottom", textStyle:{fontSize:8}})
    .setOption("backgroundColor", "#fafafa")
    .setOption("colors", ["#e53935","#43a047"])
    .setOption("hAxis", {slantedText:true, slantedTextAngle:40})
    .setOption("vAxis", {format:"short", minValue:0})
    .setOption("width", 390).setOption("height", 255)
    .build();
  dash.insertChart(chartBar);

  const chartLine = dash.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(cd.getRange("D1:E15"))
    .setPosition(17, 12, 0, 0)
    .setOption("title", "Tren Pengeluaran Bulanan")
    .setOption("legend", {position:"none"})
    .setOption("backgroundColor", "#fafafa")
    .setOption("colors", ["#e53935"])
    .setOption("lineWidth", 3).setOption("pointSize", 7).setOption("curveType", "function")
    .setOption("width", 797).setOption("height", 230)
    .build();
  dash.insertChart(chartLine);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("✅ Grafik berhasil diperbarui!");
}
