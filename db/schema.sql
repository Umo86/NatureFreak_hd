-- NATUREFreak: tables behind the site's forms (Postgres).
create table if not exists photographers (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  name         text not null,
  email        text not null unique,          -- private: never returned by the API
  location     text not null,
  specialisms  text not null,                 -- comma-separated, up to three
  for_hire     boolean not null default false,
  instagram    text not null default '',
  website      text not null default '',
  bio          text not null default '',
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now()
);
create index if not exists photographers_status_idx on photographers (status, created_at desc);

create table if not exists bookings (
  id          bigint generated always as identity primary key,
  format      text not null check (format in ('story', 'post', 'reel')),
  username    text not null,
  email       text not null,
  caption     text not null,
  post_date   date not null,
  post_time   time not null,
  media_url   text not null,
  status      text not null default 'requested' check (status in ('requested', 'confirmed', 'paid', 'posted', 'declined', 'refunded')),
  created_at  timestamptz not null default now()
);

create table if not exists subscribers (
  id          bigint generated always as identity primary key,
  email       text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists messages (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text not null,
  topic       text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);
