#!/usr/bin/env bash
# 构建并部署到 popo。用法：
#   pnpm deploy                    # 用默认 slug/title
#   pnpm deploy [slug] [title]     # 自定义
# 默认 slug=qingchuan-dashboard，title=度厂观测站
# 流程：先拉取最新数据（export-data），再构建，再部署（带动态数据 Schema），再规划 member 角色权限。
# 注意：不传 --visibility，保留 popo 上已设置的权限（可见范围）
set -euo pipefail

SLUG="${1:-qingchuan-dashboard}"
TITLE="${2:-度厂观测站}"
UPLOAD_SCRIPT="${POPO_UPLOAD_SCRIPT:-$HOME/.comate/skills/.system/popo/scripts/upload.py}"
PERM_SCRIPT="${POPO_PERM_SCRIPT:-$HOME/.comate/skills/.system/popo/scripts/permissions.py}"

# 1) 拉取最新 iCode/iCafe 数据到 src/data/dashboard.json
pnpm export-data
# 2) 构建
pnpm build
# 3) 部署（附带动态数据对象 Schema）
UPLOAD_OUT="$(
  python3 "$UPLOAD_SCRIPT" \
    --username "${POPO_USERNAME:-ziqingchuan}" \
    --title "$TITLE" \
    --slug "$SLUG" \
    --previous-slug "$SLUG" \
    --base dist \
    --entry index.html \
    --runtime-schemas - <<'JSON'
[
  {
    "object_name": "event_meta",
    "schema": {
      "type": "object",
      "description": "看板任务标注记录（分类/难度/反思/业务）",
      "properties": {
        "event_key": { "type": "string", "description": "事件唯一键" },
        "category": { "type": "string", "description": "看板分类" },
        "difficulty": { "type": "integer", "description": "难度 1-5", "minimum": 0, "maximum": 5 },
        "reflection": { "type": "string", "description": "总结反思" },
        "business": { "type": "string", "description": "所属业务" },
        "award": { "type": "string", "description": "关键成果奖牌（空串=无）", "enum": ["", "gold", "silver", "copper"] },
        "updated_at": { "type": "string", "description": "更新时间 ISO" },
        "state": { "type": "string", "description": "记录状态", "enum": ["active", "removed"] }
      },
      "required": ["event_key", "category"]
    }
  },
  {
    "object_name": "column_order",
    "schema": {
      "type": "object",
      "description": "看板列顺序记录（每分类一行）",
      "properties": {
        "category": { "type": "string", "description": "分类 id" },
        "keys": { "type": "array", "items": { "type": "string" }, "description": "该列任务 key 的有序数组" },
        "updated_at": { "type": "string", "description": "更新时间 ISO" }
      },
      "required": ["category", "keys"]
    }
  }
]
JSON
)"
echo "$UPLOAD_OUT"

# 4) 规划 member 角色权限（动态数据接口鉴权，不规划则读写全被拒）
#    上传输出含一行进度提示 + 一行 JSON，取 JSON 行解析 workId
WORK_ID="$(echo "$UPLOAD_OUT" | grep -o '"workId"[^,}]*' | head -1 | sed 's/.*"workId"[[:space:]]*:[[:space:]]*//' | tr -d '"' || true)"
if [ -n "$WORK_ID" ]; then
  python3 "$PERM_SCRIPT" \
    --username "${POPO_USERNAME:-ziqingchuan}" \
    --work-id "$WORK_ID" plan <<'JSON'
[
  {
    "name": "member",
    "description": "所有访问者",
    "permissions": [
      {"schema": "event_meta", "actions": ["create", "read", "update", "delete"], "scope": "any"},
      {"schema": "column_order", "actions": ["create", "read", "update", "delete"], "scope": "any"}
    ]
  }
]
JSON
else
  echo "[warn] 未取到 workId，跳过角色规划（动态数据读写可能被拒）"
fi
