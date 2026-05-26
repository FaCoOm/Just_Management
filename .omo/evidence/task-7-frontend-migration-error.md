# Task 7 semantic regression review

## Booking source

`src/hooks/use-dashboard-data.ts` now reads booking rows from `reservations`:

```ts
supabase.from("reservations").select("*").order("check_in_date")
```

The hook keeps `guests` only as a compatibility view model derived from reservation rows, so existing guest-labeled panels do not need UI churn in this task.

## Arrivals semantics

Previous behavior counted guest rows whose `check_in_status` was `Pending` or `Check-In Pending`.

Updated behavior counts reservation rows whose normalized `status` is `pending` or `check_in_pending` through `ARRIVAL_RESERVATION_STATUSES`. This preserves the same pending/check-in-pending arrival meaning while changing the source table.

## Departures semantics

Previous behavior counted guest rows whose `check_in_status` was `Check-Out Pending`.

Updated behavior counts reservation rows whose normalized `status` is `check_out_pending` through `DEPARTURE_RESERVATION_STATUSES`. Checked-out, cancelled, and no-show reservations are excluded from departure totals.

## Occupancy semantics

Occupancy still derives from `rooms.status` and still treats `Occupied`, `Checked In`, and `Check-Out Pending` room statuses as occupied. This task did not move occupancy to reservation allocation counts, which preserves the existing dashboard KPI meaning.

## Maintenance semantics

Maintenance totals still derive from `maintenance_issues` and count rows whose `status` is not `Resolved`. This task did not re-anchor maintenance to reservations.

## Compatibility caveat

Reservations only store stay dates (`check_in_date`, `check_out_date`), not legacy ETA/ETD timestamps. The compatibility `Guest` view maps those dates into `eta`/`etd` fields so current panels continue rendering; richer time semantics remain out of scope for this frontend cutover.
