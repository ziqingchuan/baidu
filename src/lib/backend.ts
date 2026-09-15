/**
 * 后端代码库判定（全栈转型）：在这些库里的产出视为「后端开发任务」。
 * 成就判定（全栈入门）与图表（后端里程碑）共用。新增后端代码库时往这里加。
 */
export const BACKEND_REPOS = ['bunnydo-server']

export function isBackendRepo(repo: string): boolean {
  return BACKEND_REPOS.some((r) => repo.toLowerCase().includes(r))
}
