-- Keep the persisted Compose template catalog aligned with the mobile/API
-- design IDs. Visual textures and sticker marks are rendered locally so a
-- template selection never depends on a remote image request.
insert into public.poem_design_templates (
  id,
  label,
  description,
  layout_config,
  is_active,
  display_order
)
values
  (
    'quiet-letter',
    'Quiet letter',
    'Ruled paper, literary serif and a botanical mark.',
    '{"templateId":"quiet-letter","typographyId":"literary-serif","backgroundId":"letter-paper","stickerIds":["botanical"]}'::jsonb,
    true,
    10
  ),
  (
    'night-whisper',
    'Night whisper',
    'Dark blue paper, handwritten lines and a quiet moon.',
    '{"templateId":"night-whisper","typographyId":"handwritten","backgroundId":"midnight","stickerIds":["moon"]}'::jsonb,
    true,
    20
  ),
  (
    'travel-postcard',
    'Postcard',
    'Warm correspondence paper with a postmark accent.',
    '{"templateId":"travel-postcard","typographyId":"clean-sans","backgroundId":"postcard","stickerIds":["postmark"]}'::jsonb,
    true,
    30
  ),
  (
    'ink-archive',
    'Ink archive',
    'Rice paper, editorial Songti and a pressed flower.',
    '{"templateId":"ink-archive","typographyId":"songti-editorial","backgroundId":"rice-paper","stickerIds":["pressed-flower"]}'::jsonb,
    true,
    40
  ),
  (
    'field-notes',
    'Field notes',
    'A crisp research grid with mono notes and a paperclip.',
    '{"templateId":"field-notes","typographyId":"mono-notes","backgroundId":"graph-paper","stickerIds":["paperclip","asterism"]}'::jsonb,
    true,
    50
  ),
  (
    'soft-margin',
    'Soft margin',
    'Blush stationery with rounded type and a strip of tape.',
    '{"templateId":"soft-margin","typographyId":"rounded-sans","backgroundId":"blush-paper","stickerIds":["washi"]}'::jsonb,
    true,
    60
  ),
  (
    'museum-label',
    'Museum label',
    'A restrained archive card for image-led poems.',
    '{"templateId":"museum-label","typographyId":"humanist-sans","backgroundId":"museum-card","stickerIds":["postmark","paperclip"]}'::jsonb,
    true,
    70
  )
on conflict (id) do update
set
  label = excluded.label,
  description = excluded.description,
  layout_config = excluded.layout_config,
  is_active = excluded.is_active,
  display_order = excluded.display_order,
  updated_at = now();
