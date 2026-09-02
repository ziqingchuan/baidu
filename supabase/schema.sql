-- ============================================================
-- 个人产出看板 · Supabase 建表脚本
-- 使用方法：登录 https://supabase.com/dashboard/project/vtslbeziohxlvmibthfp
--   左侧 SQL Editor → New query → 粘贴全部内容 → Run
-- ============================================================

-- 1) 任务元数据表：每个任务一条（分类/难度/反思/所属业务）
create table if not exists public.event_meta (
  event_key  text primary key,          -- 任务唯一键（card:xxx / review:xxx / commit:xxx）
  category   text not null default 'unassigned',  -- 看板分类
  difficulty integer not null default 0,          -- 难度 1-5，0 未打分
  reflection text not null default '',            -- 总结反思
  business   text,                                -- 所属业务（dodo/bunnydo/comate/ai-internal）
  updated_at timestamptz not null default now()
);

-- 2) 列顺序表：每个分类列一行，记录列内任务顺序
create table if not exists public.column_order (
  category   text primary key,          -- 分类 id
  keys       jsonb not null default '[]',  -- 该列任务 key 的有序数组
  updated_at timestamptz not null default now()
);

-- 3) 行级安全：开启 RLS（anon key 强制受 RLS 约束）
alter table public.event_meta enable row level security;
alter table public.column_order enable row level security;

-- 4) RLS 策略：允许所有读 + 认证用户可增删改
--    个人看板单用户，用宽松策略（生产多用户需按 auth.uid() 隔离）
drop policy if exists "public_read" on public.event_meta;
create policy "public_read"
  on public.event_meta for select
  using (true);

drop policy if exists "public_write" on public.event_meta;
create policy "public_write"
  on public.event_meta for all
  using (true) with check (true);

drop policy if exists "public_read" on public.column_order;
create policy "public_read"
  on public.column_order for select
  using (true);

drop policy if exists "public_write" on public.column_order;
create policy "public_write"
  on public.column_order for all
  using (true) with check (true);

-- 5) 更新时自动刷新 updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_event_meta_updated on public.event_meta;
create trigger trg_event_meta_updated
  before update on public.event_meta
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_column_order_updated on public.column_order;
create trigger trg_column_order_updated
  before update on public.column_order
  for each row execute function public.touch_updated_at();

-- 6) 快速自检：应返回 0 行（空表）
select 'event_meta' as tbl, count(*) from public.event_meta
union all
select 'column_order', count(*) from public.column_order;
