/** mock 登录：登录态存 localStorage（刷新保持），密码从环境变量 VITE_MOCK_LOGIN_PASSWORD 读取 */
/**
 * ⚠️ 注意：本登录仅为前端演示门槛（防误触），**不是安全边界**——
 * 登录态存 localStorage 可被控制台篡改绕过；VITE_ 前缀环境变量会内联进客户端 bundle，密码本身公开可读。
 * 涉及云端写操作（如数据管理后台的导入恢复）不得仅依赖此鉴权。
 */

const AUTH_KEY = 'output-dashboard:authed'

/** 是否已登录 */
export function isAuthed(): boolean {
  return localStorage.getItem(AUTH_KEY) === '1'
}

/** 设置登录态 */
export function setAuthed(authed: boolean) {
  if (authed) localStorage.setItem(AUTH_KEY, '1')
  else localStorage.removeItem(AUTH_KEY)
}

/** 校验密码（mock：前后端同源，仅作演示门槛） */
export function checkPassword(pwd: string): boolean {
  return pwd === (import.meta.env.VITE_MOCK_LOGIN_PASSWORD as string)
}
