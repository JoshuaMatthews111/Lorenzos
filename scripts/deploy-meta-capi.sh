#!/usr/bin/env bash
# Deploys the Meta Conversions API build for LDTT.
# Run from the live folder: ~/Desktop/codex-playground/lorenzo_concept1_site
#
#   1) npx supabase login                 (one time; opens the browser)
#   2) ./scripts/deploy-meta-capi.sh      (deploys the edge function)
#
# The access token is set separately and never stored in this repo:
#   npx supabase secrets set META_CAPI_ACCESS_TOKEN="<paste from Events Manager>" --project-ref ptnzaeprvkgjgtupmcty
# Optional while testing (shows events under Events Manager > Test events):
#   npx supabase secrets set META_TEST_EVENT_CODE="TESTxxxxx" --project-ref ptnzaeprvkgjgtupmcty
# Remove the test code when done:
#   npx supabase secrets unset META_TEST_EVENT_CODE --project-ref ptnzaeprvkgjgtupmcty
set -euo pipefail
REF=ptnzaeprvkgjgtupmcty   # LDTT project. Never the DSN/brighter-day project.
cd "$(dirname "$0")/.."
npx supabase functions deploy submit-contact --project-ref "$REF" --no-verify-jwt
echo
echo "Deployed. Smoke test (writes ONE qa-flagged lead that is excluded from all counts):"
echo "  ./scripts/deploy-meta-capi.sh --smoke"
if [[ "${1:-}" == "--smoke" ]]; then
  curl -s -X POST "https://$REF.supabase.co/functions/v1/submit-contact" -H 'Content-Type: application/json' \
    -d '{"qa":true,"submission_id":"qa-capi-'$(date +%s)'","first_name":"QA","last_name":"CAPI","email":"qa-capi@lorenzosdogtrainingteam.com","phone":"2165550100","zip":"44128","city":"Cleveland","state":"OH","i_want_to":"Schedule an in person evaluation with a trainer in my area","page_url":"https://www.lorenzosdogtrainingteam.com/dog-training-cleveland-oh","meta_event_id":"qa-capi-event","fbp":"fb.1.1700000000000.1234567890","timestamp":"'$(date -u +%FT%TZ)'"}'
  echo
fi
