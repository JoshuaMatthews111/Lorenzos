-- Communications is accessed only through the authenticated server API.
-- Explicit restrictive policies make the browser denial visible and durable.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'communications_alert_lists',
    'communications_alert_members',
    'communications_alert_deliveries',
    'communications_settings',
    'communications_templates',
    'communications_testers',
    'communications_campaigns',
    'communications_campaign_recipients',
    'communications_webhook_events'
  ] loop
    execute format(
      'create policy communications_deny_browser on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      table_name
    );
  end loop;
end;
$$;

alter table public.leads
  add constraint leads_communications_alert_list_id_fkey
  foreign key (communications_alert_list_id)
  references public.communications_alert_lists(id)
  on delete set null;

create index if not exists idx_leads_communications_alert_list on public.leads (communications_alert_list_id);
create index if not exists idx_communications_lists_escalation_list on public.communications_alert_lists (escalation_list_id);
create index if not exists idx_communications_lists_created_by on public.communications_alert_lists (created_by);
create index if not exists idx_communications_members_portal_user on public.communications_alert_members (portal_user_id);
create index if not exists idx_communications_deliveries_alert_list on public.communications_alert_deliveries (alert_list_id);
create index if not exists idx_communications_deliveries_alert_member on public.communications_alert_deliveries (alert_member_id);
create index if not exists idx_communications_settings_updated_by on public.communications_settings (updated_by);
create index if not exists idx_communications_templates_created_by on public.communications_templates (created_by);
create index if not exists idx_communications_templates_updated_by on public.communications_templates (updated_by);
create index if not exists idx_communications_testers_created_by on public.communications_testers (created_by);
create index if not exists idx_communications_campaigns_template on public.communications_campaigns (template_id);
create index if not exists idx_communications_campaigns_created_by on public.communications_campaigns (created_by);
create index if not exists idx_communications_campaigns_sent_by on public.communications_campaigns (sent_by);
create index if not exists idx_communications_recipients_client on public.communications_campaign_recipients (client_id);
