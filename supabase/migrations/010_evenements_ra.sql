-- Réalité augmentée, version 2 : nouveaux événements d'usage.
--  ar3d_view / ar3d_place          : panneau 3D de la note ouvert / posé dans la pièce (RA ancrée)
--  label_live_start / label_live_read : lecture de l'étiquette en direct dans la caméra
--  compare_view                    : comparateur en rayon (plusieurs vêtements à l'image)
--  ar_card_open                    : fiche enrichie ouverte dans la caméra

alter table public.events drop constraint if exists events_event_check;
alter table public.events add constraint events_event_check check (event in (
  'scan', 'product_view', 'not_found', 'details_view', 'alternatives_view',
  'premium_view', 'premium_start', 'report_sent', 'exit_after_bad_grade',
  'contribution_start', 'contribution_sent',
  'label_start', 'label_read', 'label_failed', 'passport_created', 'passport_view',
  'ar3d_view', 'ar3d_place', 'label_live_start', 'label_live_read', 'compare_view', 'ar_card_open'
));
