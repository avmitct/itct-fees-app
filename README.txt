Updated ITCT Fees Collection PWA
Includes:
1) Course management with per-course fees
2) Student balances (courseFee - paid)
3) PDF receipts (jsPDF) + printable fallback
4) Reports by course/date with CSV/PDF export
5) Admin password change (stored locally)
How to use:
- Download and unzip
- Open index.html in Chrome (best via local server: python -m http.server 8000)
- Add courses first, then add students.
- Use 'Settings' to change admin password.
Notes:
- PDFs use jsPDF via CDN; if opening via file:// some browsers may block CDN. Use local server if needed.
- To convert to Android APK use Bubblewrap / Trusted Web Activity - instructions included in README if requested.
