-- Verification finished 2026-08-17: Resend (domain verified, sending enabled) and
-- SimpleTexting both confirmed working with a real test email and text message.
-- Remove the temporary helper and the http extension it needed, so nothing in the
-- database can make outbound HTTP calls afterwards.
drop function if exists public.__provider_send_test(text, text, text, text, text, text);
drop extension if exists http;
