/** mock 登录：登录态存 localStorage（刷新保持），密码从环境变量 VITE_MOCK_LOGIN_PASSWORD 读取 */

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
