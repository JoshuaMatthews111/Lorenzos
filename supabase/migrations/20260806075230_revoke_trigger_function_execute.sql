-- These functions are invoked only by database triggers. They must not be
-- callable through the public Data API as RPC endpoints.
revoke all on function public.link_recruiting_discovery_record() from public, anon, authenticated;
revoke all on function public.capture_office_note_revision() from public, anon, authenticated;
