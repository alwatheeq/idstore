-- Keep the original covering time-window index; the later alias was identical.
drop index if exists public.resource_bookings_resource_window;
