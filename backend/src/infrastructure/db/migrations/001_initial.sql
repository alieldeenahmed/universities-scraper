create table universities (
  id serial primary key,
  slug text not null unique,
  name text not null,
  country text not null,
  website text not null,
  schedule_every_hours int not null,
  created_at timestamptz not null default now()
);

create table faculties (
  id serial primary key,
  university_id int not null references universities (id) on delete cascade,
  name text not null,
  unique (university_id, name)
);

create table departments (
  id serial primary key,
  university_id int not null references universities (id) on delete cascade,
  faculty_id int references faculties (id) on delete set null,
  name text not null,
  unique (university_id, name)
);

create table majors (
  id serial primary key,
  university_id int not null references universities (id) on delete cascade,
  external_id text not null,
  name text not null,
  degree_type text,
  faculty_id int references faculties (id) on delete set null,
  department_id int references departments (id) on delete set null,
  description text,
  credit_hours int,
  admission_requirements jsonb,
  tuition jsonb,
  source_url text not null,
  source_version text,
  content_hash text not null,
  status text not null default 'active' check (status in ('active', 'missing')),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_changed_at timestamptz not null,
  unique (university_id, external_id)
);

create index majors_university_status_idx on majors (university_id, status);

create table crawl_runs (
  id serial primary key,
  university_id int not null references universities (id) on delete cascade,
  mode text not null check (mode in ('full', 'incremental', 'repair')),
  trigger text not null check (trigger in ('schedule', 'manual', 'repair', 'startup')),
  status text not null check (status in ('pending', 'running', 'completed', 'completed_with_issues', 'failed', 'expired')),
  requested_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  progress_done int not null default 0,
  progress_total int not null default 0,
  stats jsonb not null default '{}'::jsonb,
  failure jsonb
);

-- one active run per university. Double clicks and overlapping triggers hit this.
create unique index crawl_runs_one_active_idx on crawl_runs (university_id)
  where status in ('pending', 'running');

create index crawl_runs_university_idx on crawl_runs (university_id, id desc);

create table crawl_gaps (
  id serial primary key,
  university_id int not null references universities (id) on delete cascade,
  major_external_id text,
  major_name text,
  kind text not null,
  field text,
  detail text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'gave_up')),
  attempts int not null default 1,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  resolved_at timestamptz
);

create unique index crawl_gaps_unresolved_idx
  on crawl_gaps (university_id, coalesce(major_external_id, ''), kind, coalesce(field, ''))
  where status <> 'resolved';
