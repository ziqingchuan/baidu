-- ============================================================
-- 度厂观测站 · Supabase 数据表结构 + 初始数据
-- 生成自: 导出数据0903-new.json (2026-09-03T11:24:47.126Z)
-- ============================================================

-- ---------- 建表 ----------

create table if not exists public.event_meta (
  id bigserial primary key,
  event_key text not null unique,
  category text not null default 'unassigned',
  difficulty integer not null default 0 check (difficulty between 0 and 5),
  reflection text not null default '',
  business text,
  award text,
  like_count integer not null default 0,
  updated_at timestamptz not null default now(),
  state text not null default 'active'
);

create table if not exists public.column_order (
  id bigserial primary key,
  category text not null unique,
  keys jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_meta_category on public.event_meta (category);

-- ---------- 清空旧数据（重复执行安全）----------
truncate table public.column_order, public.event_meta;

-- ---------- event_meta: 104 条 ----------
insert into public.event_meta (event_key, category, difficulty, reflection, business, award, updated_at, state) values
  ('review:120666859', 'bugfix', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120630952', 'ux', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:119968320', 'unassigned', 0, '', 'other', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120456841', 'feature', 4, '1. 经验：独立搭建完整页面时事先做好清晰的页面结构设计，再进行细节填充
2. 经验：涉及到很多video，gif加载的时候要考虑性能优化问题，不能阻塞渲染
3. 反思：要以UI出的设计稿为准，杜绝按照产品给的demo稿做完后出现重做现象', 'comate', 'silver', '2026-09-03T03:01:26.824Z', 'active'),
  ('card:dododododoit-1932', 'feature', 3, '1. 启发：agent的唤起成本越低，越能留住用户，使用体验更丝滑
2. 反思：全局快捷键的键位设计有待优化', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120617118', 'ux', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120138184', 'ux', 2, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:119972060', 'unassigned', 0, '', 'other', NULL, '2026-09-03T02:24:07.656Z', 'active'),
  ('card:dododododoit-1731', 'feature', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:122349383', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120928529', 'bugfix', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-1720', 'ux', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-40', 'feature', 3, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:b13f0892af910c565e725e7862428ed52cc1659a', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:9cc3cf0a80c9c5e70ea4638969f81fe07d817f3a', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120616793', 'ux', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120911995', 'bugfix', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120510662', 'feature', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:cff52736b98a7f0c18d3713f03454c09e0320d67', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120617035', 'ux', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120617090', 'bugfix', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-9', 'engineering', 4, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:01d1ce322d51dffc4d9eb91e79217415288b0bae', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-1742', 'ux', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-2127', 'ux', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:2aefec06a51443bf05f73ca2d385c9f9810c46f1', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:d0a1e29721e7b630fc7c2381ebc5b7d1b2f0c802', 'unassigned', 0, '', 'other', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-24', 'feature', 2, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-2197', 'unassigned', 0, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:119975756', 'unassigned', 0, '', 'other', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120045705', 'ux', 1, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-1977', 'ux', 3, '经验：不销毁DOM的话要注意考虑边界情况，特别多同时打开的文件是否会导致性能问题', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:122362147', 'efficiency', 0, '', 'ai-internal', NULL, '2026-09-02T08:16:38.966Z', 'active'),
  ('commit:4b0e45471ff924a1f71060b1c46b74742974d11f', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-2124', 'bugfix', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120482103', 'ux', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120686133', 'bugfix', 1, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120686202', 'bugfix', 1, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-2153', 'feature', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120725662', 'feature', 2, '反思：当客户端涉及多window的时候，这个消息的通信要好好理顺逻辑，不能影响用户的体验', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-23', 'engineering', 3, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120112141', 'bugfix', 2, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:936b736d19bb85503aa31ff7a273ce080f97da54', 'feature', 1, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120890600', 'ux', 1, '', 'dodo', NULL, '2026-09-02T10:07:00.000Z', 'active'),
  ('review:120661153', 'efficiency', 2, '', 'comate', NULL, '2026-09-03T11:14:00.000Z', 'active'),
  ('review:120630942', 'ux', 1, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-28', 'feature', 3, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120647366', 'feature', 3, '启发：自己设计一个页面的UI时，要考虑到全局的UI风格适配，不能有割裂感', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-10', 'engineering', 4, '1. 经验：多选用生态成熟的、agent友好的、比较流行的新方案，尽量不要默认走过去的项目的老路，多思考如何在人能看懂代码的前提下，能让agent更好进行代码编写和维护，最终实现人机协同开发的最佳实践。', 'bunnydo', 'silver', '2026-09-03T03:02:17.215Z', 'active'),
  ('card:dododododoit-2071', 'feature', 4, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120587309', 'ux', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:d9ed58c2a925ed212c6b8ef7242ea8eb00aaa970', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120458124', 'ux', 3, '经验：做样式相关开发时要考虑后续的可维护性以及代码可读性，能封装则封装，组件职责明确，低耦合', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120499803', 'ux', 3, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:791b5251cf5901e0eff5e86f57cce4ccb9bd8ec7', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-27', 'engineering', 3, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120890563', 'bugfix', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:119937998', 'unassigned', 0, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-1945', 'feature', 5, '1. 反思：在设计该能力前，一定要多在codex，claude等产品里多用一下该功能，梳理一下该功能都有什么场景，以及成熟方案是怎么处理的，避免做出来的东西有很多边界情况处理不好
2. 经验：纯靠前端实现token的匹配总会遇到一些边界情况处理问题，因此合理的与服务端进行配合效果实现很重要
3. 反思：前后端都改的需求，通常是服务端需要先上，因此要控制好代码合入的时机，以免别人把还不能发的带上了
4. 经验：如果一个大需求想拆开合入，可以拉 feature 分支，这样随便合入，等能上线了再往 master 合就行', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120659002', 'bugfix', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-35', 'feature', 3, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-26', 'engineering', 4, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-2047', 'ux', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:122357614', 'efficiency', 3, '', 'ai-internal', NULL, '2026-09-02T06:54:47.484Z', 'active'),
  ('commit:05712e92f9162b73ad46e5614327bcae8aa3944e', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:441a73c2392de265c5821d84b6c901ded983868a', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:119968313', 'unassigned', 0, '', 'other', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:122349379', 'efficiency', 5, '1. 启发：agent 很多时候有能力去完成任务，但是缺的是如何使用这个能力进行执行，因此，教agent如何更好地使用自己的能力才能最大程度发挥它的作用
2. 经验：electron可以提供很多web端所不具有的能力，在技术选型的时候要灵活决断
3. 反思：把一个能力独立做成一个客户端有点太重了，应该首先思考如何封装成agent可调用、可接入的轻量级方案（比如CLI？或者MCP插件？或者SKILL？）', 'ai-internal', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-44', 'engineering', 4, '情况：/inflow 在安卓如流样式全丢、iOS 正常。根因是 Tailwind v4 产物依赖 @layer/color-mix()/oklch() 等现代 CSS（Chrome 111+），安卓旧 WebView （如流机器人侧边栏使用的是Chrome 97）不支持。
做了什么：整体降级 Tailwind v3，构建链改 postcss + config。
反思：技术选型时考虑使用最新版本的库，没有考虑兼容性。以后注意：在做技术选型的时候并不是越新越好的。', 'bunnydo', NULL, '2026-09-03T02:35:23.177Z', 'active'),
  ('commit:86a23372013601d21287e82eb3eb7dd9d7a7fb0d', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:121805289', 'bugfix', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:122380743', 'efficiency', 0, '', 'ai-internal', NULL, '2026-09-03T06:13:06.613Z', 'active'),
  ('card:bunnydo-33', 'feature', 2, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:847e0ccfa97685c45f10cd650d25c43a94a658a4', 'efficiency', 3, '1. 经验：涉及到外部skill依赖时注意前置条件的检查和兜底
2. 经验：如何建设一个可自我进化迭代的skill值得思考，尽量少的用人手动维护，并且保持知识源的干净无污染很重要
3. 启发：真实的用户案例和场景才是优化skill的最有力的依据，用户使用comate的第一现场往往能暴露很多忽略的细节
4. 反思：目前依赖知识库的读写来记录case进行数据迭代感觉不太稳定，后续可以考虑单独有个接口用于读写数据，存放待分类归纳的case', 'comate', 'gold', '2026-09-03T03:01:59.278Z', 'active'),
  ('card:bunnydo-39', 'feature', 3, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:59efa3231509827570aee7200b1f48b03f84566f', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120061101', 'ux', 2, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120510664', 'feature', 3, '1. 经验：异形的动态容器组件可以切割一下然后组装起来
2. 反思：对于多平台场景（web端，小one内嵌），要注意UI是否兼容，不能只针对一端做', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120091987', 'bugfix', 1, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-32', 'feature', 4, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:121767864', 'ux', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-25', 'feature', 4, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120662350', 'ux', 1, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-1922', 'feature', 4, '1. 反思：win端的cookie加密变为了app-bound方式，后续有待调研具体解密方式
2. 经验：导入的cookie在保存时也需要使用electron提供加密的配置项，保障隐私安全', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120029157', 'feature', 1, '经验：在涉及到多处相同文案时，要考虑抽象成全局变量进行配置，方便统一走查与修改', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-2126', 'ux', 2, '', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-41', 'feature', 3, '', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:DevOps-iScan-41894', 'feature', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120575796', 'feature', 3, '启发：看似简单的功能和设计也可以很大程度提高一个产品的使用便捷性，要有一双能够发现产品亮点的眼睛，并思考如何迁移引入自己的产品之中', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:DevOps-iScan-41587', 'feature', 3, '1. 反思：对于untrack的文件的行数计算，要考虑方案的简易性，还要考虑边界情况，比如用户误操作引入巨大的文件树，如何兜底防止崩溃等', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:122349386', 'efficiency', 3, '启发：vibe的一些可视化工具首先要易用，实用性价值优先级最高（因此用户视图这个设计更加贴近用户真实使用时的界面场景，前后query更连续，分析起来更加便捷清晰；表格视图更偏向对某个指标的整体性筛查）', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120211648', 'bugfix', 1, '反思：在修以往开发人员遗留下来的bug时，发现多处为了实现效果而写死的代码逻辑，导致可维护性极差，自己在写代码时绝对要杜绝这种不考虑后续迭代的行为', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:84f8354a9024e43c5587bc6db3a3e114e8ff5ac3', 'efficiency', 3, '1. 启发：目前团队跨角色完成任务是大趋势，在这个情景下，如何协助后端同学更好的编写前端代码很重要，如果没有提交前的代码评审，那前端同学的cr压力会比较大，因此项目专用的代码cr的skill很有效也很有必要。', 'bunnydo', 'silver', '2026-09-03T03:28:24.691Z', 'active'),
  ('review:120616828', 'ux', 3, '启发：对于非常常见的功能的细节化打磨，有时会成为吸引住用户的关键，因此，不能局限于prd描述的内容，要以一个使用者的身份去审视你在做的功能是否真的好用！', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120265296', 'feature', 2, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120919804', 'bugfix', 5, '1. 反思：单独拿出这个bug是因为印象非常深刻，在定位问题时。花了非常多精力，最终通过给桌宠加上非透明背景发现是整个桌宠窗口尺寸异常变化，最终定位到setPosition()与setBounds()区别导致的win端异常行为。面对奇怪bug，不要放过任何可能反映出问题的解决方案，有时候UI层的暴露比控制台的日志要可靠
2. 经验：对于客户端开发，上线前不仅要在mac上测，win端也要认真测试功能的兼容性', 'dodo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('review:120195053', 'ux', 2, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:bunnydo-8', 'engineering', 4, '1. 经验：harness建设能够很大程度的提升agent的代码质量，约束行为边界，从而尽可能保持代码库的清洁和可维护，因此在项目从零到一的过程中，一定要做好harness的工程。
2. 反思：不能把harness工程完全交给agent去做，过于冗长的规约文档反而会让agent形成误区，降低执行效果，应当保证规约里放的是需要推理和判断才能得到的内容，而不是通过读代码即可获取的固定认知。控制在200行以内是比较好的实践。', 'bunnydo', 'gold', '2026-09-03T03:02:07.307Z', 'active'),
  ('card:bunnydo-22', 'feature', 3, '1. 经验：技术选型不是越新越好，也不是无脑引入功能所需的库，应当考虑人的学习成本与上手难度，平衡好agent的友好程度；在进行库的引入时，优先考虑是否有必要，然后考虑引入成本与收益，选库的时候选择轻量的，生态好的成熟方案', 'bunnydo', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('commit:3adfab2520c20ba95213cdba811489fc392b5393', 'efficiency', 3, '', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:DevOps-iScan-41404', 'feature', 2, '经验：配合agent快速进行项目上手以及扫描代码库快速了解项目架构与各个模块的职责', 'comate', NULL, '2026-09-01T13:22:49.990266+00:00', 'active'),
  ('card:dododododoit-2046', 'feature', 4, '1. 经验：开源方案的调研与接入方式的选型上的思考，以及效果尝试与对比', 'dodo', 'copper', '2026-09-03T10:22:56.480Z', 'active'),
  ('card:dododododoit-1764', 'feature', 5, '1. 经验：多调研现有的开源方案，作为实现思路（agent-browse开源方案)
2. 经验：调试能力的提升，agent协助下可以开发一些辅助调试的面板或者demo，注意正式提交时的冗余逻辑清理工作', 'dodo', 'gold', '2026-09-03T03:01:15.445Z', 'active'),
  ('review:120703896', 'feature', 5, '1. 启发：先做调研与最小化验证，再制定详细方案，这样可以避免弯路
2. 经验：再进行一个较为复杂的模块建设的时候，要把各个功能的职责梳理清晰，避免高耦合，一定要保障代码的可维护性，变量、方法的命名要语义化
3. 经验：对于非传统性的能力建设，要把调试板块设计好，这样能够事半功倍，逻辑上出现的问题可以一目了然
4. 启发：依然是要有对产品负责的态度，对于dodo这类重UI的产品，单纯依赖设计稿的静态说明不足以达到功能的效果最大化，可以考虑适度加上一些动效上的巧思（一定要和设计人员对齐才行！不能私自做主）', 'dodo', 'gold', '2026-09-03T02:56:20.871Z', 'active');

-- ---------- column_order: 6 条 ----------
insert into public.column_order (category, keys, updated_at) values
  ('bugfix', '["review:120666859", "review:120928529", "review:120911995", "card:dododododoit-2124", "review:120617090", "review:120686133", "review:120686202", "review:120112141", "review:120890563", "review:120659002", "review:121805289", "review:120211648", "review:120919804", "review:120091987"]', '2026-09-03T08:23:25.496Z'),
  ('unassigned', '["review:119968320", "review:119972060", "commit:d0a1e29721e7b630fc7c2381ebc5b7d1b2f0c802", "card:dododododoit-2197", "review:119975756", "review:119937998", "review:119968313"]', '2026-09-03T08:23:25.791Z'),
  ('ux', '["review:120630952", "card:dododododoit-1720", "review:120616793", "review:120617035", "card:dododododoit-1742", "card:dododododoit-2127", "review:120045705", "card:dododododoit-1977", "review:120482103", "review:120890600", "review:120630942", "review:120587309", "review:120499803", "review:120458124", "card:dododododoit-2047", "review:121767864", "review:120662350", "card:dododododoit-2126", "review:120061101", "review:120617118", "review:120138184", "review:120616828", "review:120195053"]', '2026-09-03T03:18:37.568Z'),
  ('engineering', '["card:bunnydo-9", "card:bunnydo-23", "card:bunnydo-10", "card:bunnydo-27", "card:bunnydo-26", "card:bunnydo-44", "card:bunnydo-8"]', '2026-09-03T03:18:37.568Z'),
  ('feature', '["review:120703896", "card:dododododoit-1764", "card:dododododoit-1731", "review:120456841", "card:bunnydo-40", "review:120510662", "card:dododododoit-2046", "card:bunnydo-24", "review:120725662", "card:dododododoit-2153", "commit:936b736d19bb85503aa31ff7a273ce080f97da54", "card:bunnydo-28", "review:120647366", "card:dododododoit-2071", "card:dododododoit-1945", "card:bunnydo-35", "card:bunnydo-33", "card:bunnydo-39", "card:bunnydo-32", "card:bunnydo-25", "card:dododododoit-1922", "review:120029157", "card:bunnydo-41", "card:DevOps-iScan-41894", "card:DevOps-iScan-41587", "review:120575796", "card:dododododoit-1932", "review:120510664", "review:120265296", "card:bunnydo-22", "card:DevOps-iScan-41404"]', '2026-09-03T11:24:16.675Z'),
  ('efficiency', '["commit:847e0ccfa97685c45f10cd650d25c43a94a658a4", "review:122349383", "commit:9cc3cf0a80c9c5e70ea4638969f81fe07d817f3a", "commit:84f8354a9024e43c5587bc6db3a3e114e8ff5ac3", "commit:b13f0892af910c565e725e7862428ed52cc1659a", "commit:cff52736b98a7f0c18d3713f03454c09e0320d67", "commit:01d1ce322d51dffc4d9eb91e79217415288b0bae", "commit:2aefec06a51443bf05f73ca2d385c9f9810c46f1", "review:122362147", "commit:4b0e45471ff924a1f71060b1c46b74742974d11f", "review:120661153", "commit:d9ed58c2a925ed212c6b8ef7242ea8eb00aaa970", "commit:791b5251cf5901e0eff5e86f57cce4ccb9bd8ec7", "review:122357614", "commit:05712e92f9162b73ad46e5614327bcae8aa3944e", "commit:441a73c2392de265c5821d84b6c901ded983868a", "review:122349379", "commit:86a23372013601d21287e82eb3eb7dd9d7a7fb0d", "review:122380743", "commit:59efa3231509827570aee7200b1f48b03f84566f", "review:122349386", "commit:3adfab2520c20ba95213cdba811489fc392b5393"]', '2026-09-03T11:24:27.936Z');

-- ---------- 验证 ----------
select 'event_meta' as tbl, count(*) from public.event_meta union all select 'column_order', count(*) from public.column_order;
