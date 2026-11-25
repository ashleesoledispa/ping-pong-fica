-- =========================================================
-- Torneo de Ping Pong · ASE UDLA FICA
-- Pega todo esto en Supabase → SQL Editor → New query → Run
-- =========================================================

create table if not exists public.inscripciones (
  id           uuid primary key,
  numero       bigint generated always as identity,
  creado       timestamptz not null default now(),
  estado       text not null default 'pendiente'
               check (estado in ('pendiente', 'confirmada', 'rechazada')),
  nombre       text not null,
  correo       text not null,
  celular      text not null,
  id_banner    text not null,
  carrera      text not null,
  comprobantes jsonb not null default '[]'::jsonb,
  nota         text not null default '',
  actualizado  timestamptz
);

-- Un mismo correo o ID Banner no puede tener dos inscripciones activas
create unique index if not exists inscripciones_correo_activo
  on public.inscripciones (correo) where estado <> 'rechazada';
create unique index if not exists inscripciones_banner_activo
  on public.inscripciones (id_banner) where estado <> 'rechazada';

-- Seguridad: nadie puede leer la tabla desde el navegador.
-- Solo el servidor (con la clave service_role) accede a los datos.
alter table public.inscripciones enable row level security;

-- Bucket privado para los comprobantes de pago
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;
