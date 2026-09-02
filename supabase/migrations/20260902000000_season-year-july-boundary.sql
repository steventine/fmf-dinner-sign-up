-- Backfill meetings whose season_year disagrees with the July-1 season boundary.
--
-- A season is an academic year labeled by the calendar year it opens in:
-- season 2026 runs 2026-07-01 through 2027-06-30. July is the cut because
-- meetings only run Sept–March, so the boundary sits in the summer dead zone
-- and can never split a season.
--
-- Why rows drifted: adminGenerateSeasonSchedule derived ONE season_year from
-- the generated range's start date and stamped it on every meeting in the
-- batch. A schedule generated in May 2026 for the autumn therefore tagged its
-- September 2026 meetings as season 2025. That writer now derives the season
-- per meeting date, so this backfill is a one-time correction.
--
-- Backwards compatible: touches only the season_year label on existing rows,
-- adds/drops nothing, and changes no schema. Old app code reads the corrected
-- value fine; it would simply keep computing the active season the old way.

UPDATE public.meetings
SET season_year = CASE
  WHEN EXTRACT(MONTH FROM date) >= 7 THEN EXTRACT(YEAR FROM date)::INT
  ELSE EXTRACT(YEAR FROM date)::INT - 1
END
WHERE season_year IS DISTINCT FROM (
  CASE
    WHEN EXTRACT(MONTH FROM date) >= 7 THEN EXTRACT(YEAR FROM date)::INT
    ELSE EXTRACT(YEAR FROM date)::INT - 1
  END
);
