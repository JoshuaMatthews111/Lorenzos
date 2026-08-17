-- Temporary: allow the read-only reporting role to invoke the one-off send check.
-- Removed with the function in 20260817173440.
grant execute on function public.__provider_send_test(text, text, text, text, text, text) to supabase_read_only_user;
