const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_KEY = 'auth_user'

let refreshingPromise = null

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

export function getUsername() {
  const user = getUser()
  return (user && (user.nickname || user.username)) || ''
}

export function isAuthenticated() {
  return Boolean(getAccessToken() || getRefreshToken())
}

export function setSession(payload) {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken)
  if (payload.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user))
  }
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function parseBody(response) {
  return response.json().catch(() => null)
}

async function rawRequest(url, options = {}, withAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }

  if (withAuth) {
    const token = getAccessToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const response = await fetch(url, {
    ...options,
    headers
  })
  const data = await parseBody(response)
  return { response, data }
}

async function refreshSession() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    throw new Error('登录已失效，请重新登录')
  }

  const { response, data } = await rawRequest(
    '/api/auth/refresh',
    {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    },
    false
  )

  if (!response.ok || !data || data.code !== 0) {
    clearSession()
    throw new Error((data && data.message) || '登录已过期，请重新登录')
  }

  setSession(data.data)
  return data.data
}

function ensureRefreshing() {
  if (!refreshingPromise) {
    refreshingPromise = refreshSession().finally(() => {
      refreshingPromise = null
    })
  }
  return refreshingPromise
}

export async function request(url, options = {}, config = {}) {
  const skipAuth = Boolean(config.skipAuth)
  let { response, data } = await rawRequest(url, options, !skipAuth)

  if (response.status === 401 && !skipAuth && !config._retried) {
    await ensureRefreshing()
    return request(url, options, { ...config, _retried: true })
  }

  if (!response.ok) {
    throw new Error((data && data.message) || `HTTP ${response.status}`)
  }

  if (data && typeof data.code === 'number' && data.code !== 0) {
    throw new Error(data.message || '请求失败')
  }

  return data
}

export async function loginApi(body) {
  const data = await request(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(body)
    },
    { skipAuth: true }
  )
  setSession(data.data)
  return data.data
}

export async function fetchCaptcha() {
  const data = await request('/api/auth/captcha', {}, { skipAuth: true })
  return data.data
}

export async function logoutApi() {
  const refreshToken = getRefreshToken()
  try {
    if (refreshToken) {
      await request(
        '/api/auth/logout',
        {
          method: 'POST',
          body: JSON.stringify({ refreshToken })
        },
        { skipAuth: true }
      )
    }
  } catch (e) {
    // 退出时即使服务端失败也清理本地会话
  } finally {
    clearSession()
  }
}
