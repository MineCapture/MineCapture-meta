-- Optional table used by sequence-approval.html to save one approval header/audit row per approved batch.
-- The approval page will still approve records if this table does not exist; it will simply skip the log insert.

create table if not exists public."PROD_SequenceApprovalBatchLog" (
    "ApprovalBatchID" uuid primary key,
    "PanID" bigint null,
    "Panel" text null,
    "production_date" date null,
    "shift_name" text null,
    "ShiftStart" timestamptz null,
    "ShiftEnd" timestamptz null,
    "ApprovedBy" text null,
    "ApprovedAt" timestamptz not null default now(),
    "ApprovalNote" text null,
    "CriticalCount" integer not null default 0,
    "WarningCount" integer not null default 0,
    "StatusLogsApproved" integer not null default 0,
    "MiningOutputsApproved" integer not null default 0,
    "BoltingOutputsApproved" integer not null default 0,
    "DrillingOutputsApproved" integer not null default 0
);

alter table public."PROD_SequenceApprovalBatchLog" enable row level security;

-- Read log rows for authenticated users.
drop policy if exists "Authenticated users can read sequence approval batch log"
on public."PROD_SequenceApprovalBatchLog";

create policy "Authenticated users can read sequence approval batch log"
on public."PROD_SequenceApprovalBatchLog"
for select
to authenticated
using (true);

-- Allow only configured approvers to insert approval-log rows.
drop policy if exists "Sequence approvers can insert approval batch log"
on public."PROD_SequenceApprovalBatchLog";

create policy "Sequence approvers can insert approval batch log"
on public."PROD_SequenceApprovalBatchLog"
for insert
to authenticated
with check (
    exists (
        select 1
        from public."APP_SequenceApprovers" a
        where a."UserID" = auth.uid()
          and coalesce(a."CanApprove", false) = true
    )
);

-- Sequence plan image note:
-- The approval page expects to be able to read public."MINE_SequencePlans" and find one of these fields:
-- "ImagePath", "PlanImagePath", "SequencePlanImagePath", "ImageURL", "ImageUrl", "image_url", or "PlanImageURL".
-- If your table uses RLS, add a SELECT policy for authenticated approvers/users as appropriate.
