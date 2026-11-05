-- Etapa inicial: esquema interno, sin acceso directo desde la API pública.
-- No contiene todavía funciones de acceso ni políticas de lectura/escritura.
create schema if not exists healthdiet_core;
revoke all on schema healthdiet_core from public, anon, authenticated;

create table healthdiet_core.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table healthdiet_core.members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references healthdiet_core.workspaces(id),
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  color text not null default '#2d7a5a' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  role text not null check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  check (left_at is not null or user_id is not null),
  unique (workspace_id, id)
);
create unique index one_active_workspace_per_user
  on healthdiet_core.members(user_id) where left_at is null;
create index members_by_workspace on healthdiet_core.members(workspace_id);

create table healthdiet_core.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references healthdiet_core.workspaces(id),
  invited_email text not null check (length(trim(invited_email)) between 3 and 320),
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  foreign key (workspace_id, invited_by) references healthdiet_core.members(workspace_id, id),
  check (expires_at > created_at),
  check (accepted_at is null or revoked_at is null)
);
create index invitations_by_workspace on healthdiet_core.invitations(workspace_id);

create table healthdiet_core.recipes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references healthdiet_core.workspaces(id),
  name text not null check (length(trim(name)) between 1 and 120),
  container text,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index recipes_by_workspace on healthdiet_core.recipes(workspace_id);

create table healthdiet_core.dishes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  recipe_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  position integer not null check (position >= 0),
  foreign key (workspace_id, recipe_id) references healthdiet_core.recipes(workspace_id, id) on delete cascade,
  unique (workspace_id, id)
);
create index dishes_by_recipe on healthdiet_core.dishes(workspace_id, recipe_id);

create table healthdiet_core.ingredients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  dish_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  unit text not null check (unit in ('g', 'unidad')),
  position integer not null check (position >= 0),
  foreign key (workspace_id, dish_id) references healthdiet_core.dishes(workspace_id, id) on delete cascade,
  unique (workspace_id, id)
);
create index ingredients_by_dish on healthdiet_core.ingredients(workspace_id, dish_id);

create table healthdiet_core.ingredient_quantities (
  workspace_id uuid not null,
  ingredient_id uuid not null,
  member_id uuid not null,
  quantity numeric not null check (quantity > 0 and quantity < 1000000000),
  primary key (ingredient_id, member_id),
  foreign key (workspace_id, ingredient_id) references healthdiet_core.ingredients(workspace_id, id) on delete cascade,
  foreign key (workspace_id, member_id) references healthdiet_core.members(workspace_id, id)
);
create index quantities_by_member on healthdiet_core.ingredient_quantities(workspace_id, member_id);

create table healthdiet_core.menus (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references healthdiet_core.workspaces(id),
  name text not null check (length(trim(name)) between 1 and 120),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index one_active_menu_per_workspace on healthdiet_core.menus(workspace_id) where active;
create index menus_by_workspace on healthdiet_core.menus(workspace_id);

create table healthdiet_core.menu_recipes (
  workspace_id uuid not null,
  menu_id uuid not null,
  recipe_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  meal text not null check (meal in ('desayuno', 'almuerzo', 'comida', 'merienda', 'cena')),
  position integer not null check (position >= 0),
  primary key (menu_id, weekday, meal, recipe_id),
  foreign key (workspace_id, menu_id) references healthdiet_core.menus(workspace_id, id) on delete cascade,
  foreign key (workspace_id, recipe_id) references healthdiet_core.recipes(workspace_id, id)
);
create index menu_recipes_by_recipe on healthdiet_core.menu_recipes(workspace_id, recipe_id);

create table healthdiet_core.containers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references healthdiet_core.workspaces(id),
  name text not null check (length(trim(name)) between 1 and 60),
  unique (workspace_id, name)
);

alter table healthdiet_core.workspaces enable row level security;
alter table healthdiet_core.members enable row level security;
alter table healthdiet_core.invitations enable row level security;
alter table healthdiet_core.recipes enable row level security;
alter table healthdiet_core.dishes enable row level security;
alter table healthdiet_core.ingredients enable row level security;
alter table healthdiet_core.ingredient_quantities enable row level security;
alter table healthdiet_core.menus enable row level security;
alter table healthdiet_core.menu_recipes enable row level security;
alter table healthdiet_core.containers enable row level security;
revoke all on all tables in schema healthdiet_core from public, anon, authenticated;
