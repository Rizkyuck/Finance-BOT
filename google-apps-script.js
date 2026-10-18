// ============================================================
// GOOGLE APPS SCRIPT - KyFinance BOT
// Full Dashboard Visual dengan Grafik Otomatis
// ============================================================

const SHEET_TX = "Transactions";
const SHEET_DASHBOARD = "Dashboard";
const SHEET_CHART_DATA = "ChartData"; // hidden pivot untuk grafik

// ============================================================
// MAIN ENDPOINT
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_TX);

    // Inisialisasi Sheet Transaksi jika belum ada
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_TX);
      const headers = ["Tanggal", "Tipe", "Kategori", "Nominal", "Dari Akun", "Ke Akun", "Catatan", "Bulan-Tahun"];
      sheet.appendRow(headers);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#1a73e8").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    // 1. Catat Transaksi Baru
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

      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 4).setNumberFormat('"Rp"#,##0');

      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Hapus Transaksi Terakhir (UNDO)
    if (data.action === "DELETE_LAST") {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const deletedValues = sheet.getRange(lastRow, 1, 1, 8).getValues()[0];
        sheet.deleteRow(lastRow);
        return ContentService.createTextOutput(JSON.stringify({ status: "success", deletedRow: deletedValues })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "empty" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Ambil Semua Data Transaksi
    if (data.action === "GET_DATA") {
      const rows = sheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", rows: rows })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}


// ============================================================
// SETUP DASHBOARD — Jalankan manual dari editor untuk rebuild
// ============================================================
function setupDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ---- 1. Siapkan sheet Transactions kalau belum ada ----
  let txSheet = ss.getSheetByName(SHEET_TX);
  if (!txSheet) {
    txSheet = ss.insertSheet(SHEET_TX);
    const headers = ["Tanggal", "Tipe", "Kategori", "Nominal", "Dari Akun", "Ke Akun", "Catatan", "Bulan-Tahun"];
    txSheet.appendRow(headers);
    txSheet.getRange(1, 1, 1, 8).setBackground("#1a73e8").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
    txSheet.setFrozenRows(1);
  }

  // ---- 2. Hapus & buat ulang ChartData (pivot tersembunyi) ----
  let cdSheet = ss.getSheetByName(SHEET_CHART_DATA);
  if (cdSheet) ss.deleteSheet(cdSheet);
  cdSheet = ss.insertSheet(SHEET_CHART_DATA);
  cdSheet.hideSheet();

  // Header ChartData
  cdSheet.getRange("A1").setValue("Kategori");
  cdSheet.getRange("B1").setValue("Total Pengeluaran");
  cdSheet.getRange("D1").setValue("Bulan");
  cdSheet.getRange("E1").setValue("Pengeluaran");
  cdSheet.getRange("F1").setValue("Pemasukan");

  // Pivot kategori (A2:B) - QUERY dari Transactions
  cdSheet.getRange("A2").setFormula(
    '=IFERROR(QUERY(Transactions!A2:H,"SELECT C, SUM(D) WHERE B = \'EXPENSE\' AND C <> \'-\' GROUP BY C ORDER BY SUM(D) DESC LABEL C \'\', SUM(D) \'\'",0),{"Belum ada data",0})'
  );

  // Pivot bulanan (D2:F) - bulan, expense, income
  cdSheet.getRange("D2").setFormula(
    '=IFERROR(QUERY(Transactions!A2:H,"SELECT H, SUM(D) WHERE B = \'EXPENSE\' AND H <> \'\' GROUP BY H ORDER BY H ASC LABEL H \'\', SUM(D) \'\'",0),{"Belum ada data",0})'
  );
  cdSheet.getRange("F2").setFormula(
    '=IFERROR(QUERY(Transactions!A2:H,"SELECT SUM(D) WHERE B = \'INCOME\' AND H <> \'\' GROUP BY H ORDER BY H ASC LABEL SUM(D) \'\'",0),{0})'
  );

  // ---- 3. Hapus & buat ulang Dashboard ----
  let dash = ss.getSheetByName(SHEET_DASHBOARD);
  if (dash) ss.deleteSheet(dash);
  dash = ss.insertSheet(SHEET_DASHBOARD, 0);
  dash.setTabColor("#0f9d58");

  // -- Lebar kolom supaya rapi --
  dash.setColumnWidth(1, 160);
  dash.setColumnWidth(2, 160);
  dash.setColumnWidth(3, 20);  // spacer
  dash.setColumnWidth(4, 120);
  dash.setColumnWidth(5, 160);
  dash.setColumnWidth(6, 160);
  dash.setColumnWidth(7, 20);  // spacer
  dash.setColumnWidth(8, 160);
  dash.setColumnWidth(9, 160);

  // -- Tinggi baris header --
  dash.setRowHeight(1, 50);
  dash.setRowHeight(3, 30);
  dash.setRowHeight(11, 30);
  dash.setRowHeight(20, 30);

  // ---- TITLE BANNER ----
  dash.getRange("A1:I1").merge()
    .setValue("📊 DASHBOARD KEUANGAN PRIBADI — KyFinance")
    .setBackground("#202124")
    .setFontColor("#ffffff")
    .setFontSize(16)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  dash.getRange("A2:I2").merge()
    .setValue("Auto-update setiap ada transaksi baru via Telegram @KyFinance_BOT")
    .setBackground("#303134")
    .setFontColor("#9aa0a6")
    .setFontSize(10)
    .setHorizontalAlignment("center");

  // ============================================================
  // BAGIAN KIRI: KARTU SALDO & ASET (A3:B9)
  // ============================================================
  dash.getRange("A3:B3").merge()
    .setValue("💵  SALDO & ASET SAAT INI")
    .setBackground("#1a73e8")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  const asetLabels = [
    ["🪙  Cash", '=SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*Cash*")+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*Cash*")-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*Cash*")+SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!F:F,"*Cash*")-SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!E:E,"*Cash*")'],
    ["📱  E-Wallet (Gopay/OVO/Dana)", '=SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*Gopay*")+SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*OVO*")+SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*Dana*")+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*Gopay*")+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*OVO*")+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*Dana*")-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*Gopay*")-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*OVO*")-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*Dana*")+SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!F:F,"*Gopay*")-SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!E:E,"*Gopay*")'],
    ["🏦  Bank (BCA/SeaBank/Mandiri)", '=SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*BCA*")+SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*SeaBank*")+SUMIFS(Transactions!D:D,Transactions!B:B,"SET_BALANCE",Transactions!E:E,"*Mandiri*")+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*BCA*")+SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!E:E,"*SeaBank*")-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*BCA*")-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*SeaBank*")-SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!E:E,"*Mandiri*")+SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!F:F,"*BCA*")-SUMIFS(Transactions!D:D,Transactions!B:B,"TRANSFER",Transactions!E:E,"*BCA*")'],
    ["📈  Investasi (Bibit/dll)", '=SUMIFS(Transactions!D:D,Transactions!B:B,"INVEST")'],
  ];

  const asetBgColors = ["#e8f5e9", "#e3f2fd", "#fff8e1", "#fce4ec"];
  const asetBorderColors = ["#2e7d32", "#1565c0", "#f57f17", "#c62828"];

  asetLabels.forEach(([label, formula], i) => {
    const row = 4 + i;
    dash.setRowHeight(row, 40);
    dash.getRange(row, 1).setValue(label)
      .setBackground(asetBgColors[i])
      .setFontWeight("bold")
      .setVerticalAlignment("middle");
    dash.getRange(row, 2).setFormula(formula)
      .setBackground(asetBgColors[i])
      .setNumberFormat('"Rp"#,##0')
      .setFontColor("#1a237e")
      .setFontWeight("bold")
      .setFontSize(12)
      .setVerticalAlignment("middle")
      .setHorizontalAlignment("right");
  });

  // TOTAL ASET
  dash.setRowHeight(8, 45);
  dash.getRange("A8").setValue("🏆  TOTAL ASET")
    .setBackground("#202124").setFontColor("#ffffff").setFontWeight("bold").setFontSize(12).setVerticalAlignment("middle");
  dash.getRange("B8").setFormula("=SUM(B4:B7)")
    .setBackground("#202124").setFontColor("#4fc3f7").setFontWeight("bold").setFontSize(14)
    .setNumberFormat('"Rp"#,##0').setVerticalAlignment("middle").setHorizontalAlignment("right");

  // Border area aset
  dash.getRange("A3:B8").setBorder(true, true, true, true, true, true, "#9e9e9e", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Bulan ini ringkasan
  dash.setRowHeight(9, 10); // spacer
  dash.setRowHeight(10, 40);
  dash.getRange("A10").setValue("📆  Bulan Ini — Pengeluaran")
    .setBackground("#ff7043").setFontColor("#ffffff").setFontWeight("bold").setVerticalAlignment("middle");
  dash.getRange("B10").setFormula('=SUMIFS(Transactions!D:D,Transactions!B:B,"EXPENSE",Transactions!H:H,TEXT(TODAY(),"yyyy-MM"))')
    .setBackground("#ff7043").setFontColor("#ffffff").setFontWeight("bold").setFontSize(13)
    .setNumberFormat('"Rp"#,##0').setVerticalAlignment("middle").setHorizontalAlignment("right");

  dash.setRowHeight(11, 40);
  dash.getRange("A11").setValue("📆  Bulan Ini — Pemasukan")
    .setBackground("#43a047").setFontColor("#ffffff").setFontWeight("bold").setVerticalAlignment("middle");
  dash.getRange("B11").setFormula('=SUMIFS(Transactions!D:D,Transactions!B:B,"INCOME",Transactions!H:H,TEXT(TODAY(),"yyyy-MM"))')
    .setBackground("#43a047").setFontColor("#ffffff").setFontWeight("bold").setFontSize(13)
    .setNumberFormat('"Rp"#,##0').setVerticalAlignment("middle").setHorizontalAlignment("right");

  dash.getRange("A10:B11").setBorder(true, true, true, true, true, true, "#9e9e9e", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // ============================================================
  // BAGIAN KANAN: REKAP BULANAN (D3:F ...)
  // ============================================================
  dash.getRange("D3:F3").merge()
    .setValue("📅  REKAP PER BULAN")
    .setBackground("#ea4335")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  dash.getRange("D4").setValue("Bulan").setFontWeight("bold").setBackground("#fce8e6").setHorizontalAlignment("center");
  dash.getRange("E4").setValue("💸 Pengeluaran").setFontWeight("bold").setBackground("#fce8e6").setHorizontalAlignment("center");
  dash.getRange("F4").setValue("💰 Pemasukan").setFontWeight("bold").setBackground("#fce8e6").setHorizontalAlignment("center");

  // Pakai QUERY dari ChartData (pivot yg sudah dibuat)
  dash.getRange("D5").setFormula(
    '=IFERROR(QUERY(ChartData!D2:F,"SELECT Col1, Col2, Col3 WHERE Col1 <> \'\' ORDER BY Col1 DESC",0),{"Belum ada data","",""})'
  );
  dash.getRange("E5:F20").setNumberFormat('"Rp"#,##0');
  dash.getRange("D4:F20").setBorder(true, true, true, true, true, true, "#ffa0a0", SpreadsheetApp.BorderStyle.SOLID);

  // ============================================================
  // BAGIAN KANAN: TOP KATEGORI (H3:I...)
  // ============================================================
  dash.getRange("H3:I3").merge()
    .setValue("🏷️  TOP KATEGORI PENGELUARAN")
    .setBackground("#9c27b0")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  dash.getRange("H4").setValue("Kategori").setFontWeight("bold").setBackground("#f3e5f5").setHorizontalAlignment("center");
  dash.getRange("I4").setValue("Total").setFontWeight("bold").setBackground("#f3e5f5").setHorizontalAlignment("center");

  dash.getRange("H5").setFormula(
    '=IFERROR(QUERY(ChartData!A2:B,"SELECT Col1, Col2 WHERE Col1 <> \'\' ORDER BY Col2 DESC LIMIT 10",0),{"Belum ada data",0})'
  );
  dash.getRange("I5:I15").setNumberFormat('"Rp"#,##0');
  dash.getRange("H4:I15").setBorder(true, true, true, true, true, true, "#ce93d8", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // ============================================================
  // SECTION HEADER GRAFIK — row 14
  // ============================================================
  dash.setRowHeight(13, 15); // spacer kecil

  dash.getRange("A14:I14").merge()
    .setValue("📊  VISUALISASI & GRAFIK")
    .setBackground("#37474f")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  dash.setRowHeight(14, 35);

  // ============================================================
  // GRAFIK 1: PIE DONUT — Pengeluaran per Kategori
  //   → row 15, col A
  // ============================================================
  Utilities.sleep(1000);

  const pieChart = dash.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(cdSheet.getRange("A1:B15"))
    .setPosition(15, 1, 10, 5)
    .setOption("title", "🥧 Pengeluaran per Kategori")
    .setOption("titleTextStyle", { fontSize: 13, bold: true, color: "#202124" })
    .setOption("pieHole", 0.4)  // donut chart
    .setOption("legend", { position: "right", textStyle: { fontSize: 10 } })
    .setOption("backgroundColor", "#f8f9fa")
    .setOption("chartArea", { width: "80%", height: "80%" })
    .setOption("width", 420)
    .setOption("height", 280)
    .setOption("colors", ["#4285f4", "#ea4335", "#fbbc04", "#34a853", "#ff6d00", "#46bdc6", "#7b1fa2", "#0d47a1", "#e91e63", "#1b5e20"])
    .build();

  dash.insertChart(pieChart);

  // ============================================================
  // GRAFIK 2: COLUMN — Pengeluaran vs Pemasukan per Bulan
  //   → row 15, col D (kolom 4)
  // ============================================================
  const barChart = dash.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(cdSheet.getRange("D1:F1"))
    .addRange(cdSheet.getRange("D2:F15"))
    .setPosition(15, 4, 10, 5)
    .setOption("title", "Pengeluaran vs Pemasukan per Bulan")
    .setOption("titleTextStyle", { fontSize: 12, bold: true, color: "#202124" })
    .setOption("legend", { position: "bottom", textStyle: { fontSize: 9 } })
    .setOption("backgroundColor", "#ffffff")
    .setOption("hAxis", { textStyle: { fontSize: 8 }, slantedText: true, slantedTextAngle: 45 })
    .setOption("vAxis", { format: "short", minValue: 0, textStyle: { fontSize: 8 } })
    .setOption("colors", ["#ea4335", "#34a853"])
    .setOption("bar", { groupWidth: "60%" })
    .setOption("chartArea", { left: 55, top: 40, width: "72%", height: "65%" })
    .setOption("width", 420)
    .setOption("height", 260)
    .build();
  dash.insertChart(barChart);

  // ============================================================
  // GRAFIK 3: LINE — Tren Pengeluaran Bulanan
  //   → row 15, col H (kolom 8)
  // ============================================================
  const lineChart = dash.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(cdSheet.getRange("D1:E15"))
    .setPosition(15, 8, 10, 5)
    .setOption("title", "Tren Pengeluaran Bulanan")
    .setOption("titleTextStyle", { fontSize: 12, bold: true, color: "#202124" })
    .setOption("legend", { position: "none" })
    .setOption("backgroundColor", "#ffffff")
    .setOption("hAxis", { textStyle: { fontSize: 8 }, slantedText: true, slantedTextAngle: 45 })
    .setOption("vAxis", { format: "short", minValue: 0, textStyle: { fontSize: 8 } })
    .setOption("colors", ["#ea4335"])
    .setOption("lineWidth", 3)
    .setOption("pointSize", 6)
    .setOption("curveType", "function")
    .setOption("chartArea", { left: 45, top: 40, width: "75%", height: "65%" })
    .setOption("width", 380)
    .setOption("height", 260)
    .build();
  dash.insertChart(lineChart);

  // ============================================================
  // FOOTER — row 28 (setelah grafik ~260px ≈ 13 baris dari row 15)
  // ============================================================
  dash.getRange("A28:I28").merge()
    .setValue("⚡ Powered by KyFinance BOT — @KyFinance_BOT | Data otomatis dari Telegram | " + new Date().toLocaleString("id-ID"))
    .setBackground("#303134")
    .setFontColor("#9aa0a6")
    .setFontSize(9)
    .setHorizontalAlignment("center");

  dash.autoResizeColumns(1, 2);
  dash.autoResizeColumns(4, 3);
  dash.autoResizeColumns(8, 2);

  SpreadsheetApp.flush();
  Logger.log("✅ Dashboard & Charts berhasil dibuat!");
}


// ============================================================
// REFRESH CHARTS — Jalankan manual jika ingin update grafik
// ============================================================
function refreshCharts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dash = ss.getSheetByName(SHEET_DASHBOARD);
  const cdSheet = ss.getSheetByName(SHEET_CHART_DATA);

  if (!dash || !cdSheet) {
    SpreadsheetApp.getUi().alert("Jalankan setupDashboard() dulu!");
    return;
  }

  const charts = dash.getCharts();
  charts.forEach(c => dash.removeChart(c));
  Utilities.sleep(500);

  const pieChart = dash.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(cdSheet.getRange("A1:B15"))
    .setPosition(15, 1, 10, 5)
    .setOption("title", "Pengeluaran per Kategori")
    .setOption("pieHole", 0.4)
    .setOption("legend", { position: "right", textStyle: { fontSize: 9 } })
    .setOption("backgroundColor", "#ffffff")
    .setOption("colors", ["#4285f4","#ea4335","#fbbc04","#34a853","#ff6d00","#46bdc6","#7b1fa2","#0d47a1","#e91e63","#1b5e20"])
    .setOption("width", 380).setOption("height", 260)
    .build();
  dash.insertChart(pieChart);

  const barChart = dash.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(cdSheet.getRange("D1:F1"))
    .addRange(cdSheet.getRange("D2:F15"))
    .setPosition(15, 4, 10, 5)
    .setOption("title", "Pengeluaran vs Pemasukan per Bulan")
    .setOption("colors", ["#ea4335","#34a853"])
    .setOption("backgroundColor", "#ffffff")
    .setOption("hAxis", { slantedText: true, slantedTextAngle: 45 })
    .setOption("vAxis", { format: "short" })
    .setOption("width", 420).setOption("height", 260)
    .build();
  dash.insertChart(barChart);

  const lineChart = dash.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(cdSheet.getRange("D1:E15"))
    .setPosition(15, 8, 10, 5)
    .setOption("title", "Tren Pengeluaran Bulanan")
    .setOption("colors", ["#ea4335"])
    .setOption("backgroundColor", "#ffffff")
    .setOption("lineWidth", 3).setOption("pointSize", 6).setOption("curveType", "function")
    .setOption("width", 380).setOption("height", 260)
    .build();
  dash.insertChart(lineChart);

  SpreadsheetApp.flush();
  Logger.log("✅ Charts diperbarui!");
  SpreadsheetApp.getUi().alert("✅ Charts berhasil diperbarui!");
}
