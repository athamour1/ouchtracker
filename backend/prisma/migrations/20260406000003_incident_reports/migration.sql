-- CreateTable
CREATE TABLE "incident_reports" (
    "id"           TEXT NOT NULL,
    "description"  TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kitId"        TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_report_items" (
    "id"               TEXT NOT NULL,
    "quantityUsed"     INTEGER NOT NULL,
    "notes"            TEXT,
    "incidentReportId" TEXT NOT NULL,
    "kitItemId"        TEXT NOT NULL,

    CONSTRAINT "incident_report_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_kitId_fkey"
    FOREIGN KEY ("kitId") REFERENCES "kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reportedById_fkey"
    FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_report_items" ADD CONSTRAINT "incident_report_items_incidentReportId_fkey"
    FOREIGN KEY ("incidentReportId") REFERENCES "incident_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "incident_report_items" ADD CONSTRAINT "incident_report_items_kitItemId_fkey"
    FOREIGN KEY ("kitItemId") REFERENCES "kit_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
