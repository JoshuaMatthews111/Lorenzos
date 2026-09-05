-- Practice twins of every Storage bucket the portal uses, with the same
-- public flag, size limit and allowed MIME types as the live bucket. Objects
-- uploaded on the practice copy land here (lib/sandbox.js bucketName()), and
-- the storage.objects policies created by practice.sync_structure_from_live()
-- already name these buckets. Idempotent. Never touches a live bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'practice-' || b.id, 'practice-' || b.id, b.public, b.file_size_limit, b.allowed_mime_types
from storage.buckets b
where b.id not like 'practice-%' and b.id <> 'sandbox-practice-layer'
on conflict (id) do nothing;
