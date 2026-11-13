-- The season shown in the app's name, and a hard stop on deleting players or fine types.

alter table public.settings
  add column season text not null default '2026/27' check (season ~ '^\d{4}/\d{2}$');

-- Players and fine types can be renamed or marked inactive, never deleted: removing a player
-- would cascade away all their fines and payments. Revoking the privilege (rather than hiding
-- a button) makes it hold for any client.
revoke delete on public.players, public.fine_types from authenticated;
