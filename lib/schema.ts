// Database schema. Safe to run repeatedly: every statement is idempotent.
export const schema = /* sql */ `
create table if not exists users (
  id serial primary key,
  email text not null unique,
  name text,
  phone text,
  role text not null default 'agent' check (role in ('admin','agent')),
  password_hash text not null,
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by int,
  last_login_at timestamptz,
  last_seen_at timestamptz
);

create table if not exists sessions (
  id text primary key,
  user_id int not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  ip text,
  user_agent text
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists login_events (
  id bigserial primary key,
  user_id int references users(id) on delete set null,
  email text,
  event text not null default 'sign_in',
  success boolean not null,
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists login_events_created_idx on login_events(created_at desc);

create table if not exists projects (
  id serial primary key,
  name text not null,
  community text,
  developer text,
  price_studio numeric, price_1br numeric, price_2br numeric, price_3br numeric, price_4br numeric, price_5br numeric,
  price_typical numeric,
  price_source text,
  price_basis text,
  lat double precision,
  lng double precision,
  updated_at timestamptz not null default now()
);
create unique index if not exists projects_name_idx on projects(lower(name));

create table if not exists investors (
  id serial primary key,
  ref text unique,
  name text not null,
  aliases text[] not null default '{}',
  phones text[] not null default '{}',
  bad_phones text[] not null default '{}',
  phone_country text,
  name_origin text,
  nationality text,
  total_units int not null default 0,
  priced_units int not null default 0,
  est_value numeric not null default 0,
  communities int not null default 0,
  premium_units int not null default 0,
  shared_units int not null default 0,
  max_in_project int not null default 0,
  top_community text,
  top_project text,
  tier text,
  value_band text,
  tags text[] not null default '{}',
  status text,
  last_contact_at timestamptz,
  last_contact_by int references users(id) on delete set null,
  next_follow_up_at timestamptz,
  contact_count int not null default 0,
  assigned_to int references users(id) on delete set null,
  assigned_at timestamptz,
  do_not_call boolean not null default false,
  search text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists investors_value_idx on investors(est_value desc);
create index if not exists investors_tier_idx on investors(tier);
create index if not exists investors_assigned_idx on investors(assigned_to);
create index if not exists investors_followup_idx on investors(next_follow_up_at) where next_follow_up_at is not null;
create index if not exists investors_phones_idx on investors using gin(phones);

create table if not exists units (
  id serial primary key,
  investor_id int not null references investors(id) on delete cascade,
  project_id int not null references projects(id),
  unit_code text,
  bedrooms smallint,
  value_override numeric,
  purchase_date date,
  purchase_price numeric,
  est_value numeric,
  owners_count int not null default 1,
  import_id int,
  created_at timestamptz not null default now()
);
create unique index if not exists units_unique_idx on units(investor_id, project_id, unit_code);
create index if not exists units_investor_idx on units(investor_id);
create index if not exists units_code_idx on units(project_id, unit_code);

create table if not exists activities (
  id bigserial primary key,
  investor_id int not null references investors(id) on delete cascade,
  user_id int references users(id) on delete set null,
  type text not null,
  outcome text,
  note text,
  follow_up_at timestamptz,
  phone text,
  template_name text,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists activities_investor_idx on activities(investor_id, created_at desc);
create index if not exists activities_created_idx on activities(created_at desc);
create index if not exists activities_user_idx on activities(user_id, created_at desc);

create table if not exists templates (
  id serial primary key,
  name text not null,
  body text not null,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value text not null
);

create table if not exists imports (
  id serial primary key,
  user_id int references users(id) on delete set null,
  file_name text,
  status text not null default 'staging',
  total_rows int not null default 0,
  summary jsonb,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create table if not exists import_rows (
  import_id int not null references imports(id) on delete cascade,
  idx int not null,
  kind text not null default 'unit',
  data jsonb not null,
  primary key (import_id, kind, idx)
);
`;
