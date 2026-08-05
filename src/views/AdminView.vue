<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-dot"></span>
        <div>
          <strong>api-test</strong>
          <p>Enterprise Console</p>
        </div>
      </div>
      <nav class="menu">
        <button class="menu-item active" type="button">用户管理</button>
      </nav>
      <div class="sidebar-foot">
        <p>登录密码已 BCrypt 加密入库</p>
        <p>业务用户存于 user_info</p>
      </div>
    </aside>

    <div class="main">
      <header class="header">
        <div>
          <h1>用户管理</h1>
          <p class="breadcrumb">首页 / 系统管理 / 用户管理</p>
        </div>
        <div class="header-right">
          <div class="avatar">{{ username.slice(0, 1).toUpperCase() }}</div>
          <div class="account">
            <strong>{{ username || 'admin' }}</strong>
            <span>系统管理员</span>
          </div>
          <button class="ghost" type="button" @click="logout">退出登录</button>
        </div>
      </header>

      <section class="workspace">
        <div class="toolbar">
          <div>
            <h2>用户列表</h2>
            <p>支持新建、删除业务用户；数据实时来自后端接口。</p>
          </div>
          <div class="toolbar-actions">
            <button class="secondary" type="button" :disabled="listLoading" @click="loadUsers">刷新</button>
            <button class="primary" type="button" @click="openCreate">新建用户</button>
          </div>
        </div>

        <div class="table-card">
          <div v-if="listError" class="banner error">{{ listError }}</div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>昵称</th>
                <th>邮箱</th>
                <th>手机号</th>
                <th>性别</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="listLoading">
                <td colspan="9" class="empty">加载中...</td>
              </tr>
              <tr v-else-if="users.length === 0">
                <td colspan="9" class="empty">暂无用户，点击右上角「新建用户」</td>
              </tr>
              <tr v-for="item in users" :key="item.id">
                <td>{{ item.id }}</td>
                <td>{{ item.username }}</td>
                <td>{{ item.nickname || '-' }}</td>
                <td>{{ item.email || '-' }}</td>
                <td>{{ item.phone || '-' }}</td>
                <td>{{ genderText(item.gender) }}</td>
                <td>
                  <span class="tag" :class="item.status === 1 ? 'ok' : 'off'">
                    {{ item.status === 1 ? '正常' : '禁用' }}
                  </span>
                </td>
                <td>{{ formatTime(item.createdAt) }}</td>
                <td>
                  <button
                    class="danger-link"
                    type="button"
                    :disabled="deletingId === item.id"
                    @click="confirmDelete(item)"
                  >
                    {{ deletingId === item.id ? '删除中...' : '删除' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div v-if="showCreate" class="modal-mask" @click.self="closeCreate">
      <div class="modal">
        <div class="modal-head">
          <h3>新建用户</h3>
          <button class="icon-close" type="button" @click="closeCreate">×</button>
        </div>
        <form class="modal-body" @submit.prevent="createUser">
          <div class="form-grid">
            <label>
              <span>用户名 *</span>
              <input v-model.trim="form.username" type="text" placeholder="2~50 个字符" required />
            </label>
            <label>
              <span>昵称</span>
              <input v-model.trim="form.nickname" type="text" placeholder="可选" />
            </label>
            <label>
              <span>邮箱</span>
              <input v-model.trim="form.email" type="email" placeholder="可选" />
            </label>
            <label>
              <span>手机号</span>
              <input v-model.trim="form.phone" type="text" placeholder="11 位手机号" />
            </label>
            <label>
              <span>性别</span>
              <select v-model.number="form.gender">
                <option :value="0">未知</option>
                <option :value="1">男</option>
                <option :value="2">女</option>
              </select>
            </label>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="modal-actions">
            <button class="secondary" type="button" @click="closeCreate">取消</button>
            <button class="primary" type="submit" :disabled="creating">
              {{ creating ? '提交中...' : '确认创建' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getUsername, logoutApi, request } from '../api/http'

const router = useRouter()
const username = getUsername()

const users = ref([])
const listLoading = ref(false)
const listError = ref('')
const showCreate = ref(false)
const creating = ref(false)
const formError = ref('')
const deletingId = ref(null)

const form = reactive({
  username: '',
  nickname: '',
  email: '',
  phone: '',
  gender: 0
})

function genderText(gender) {
  if (gender === 1) return '男'
  if (gender === 2) return '女'
  return '未知'
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

function resetForm() {
  form.username = ''
  form.nickname = ''
  form.email = ''
  form.phone = ''
  form.gender = 0
  formError.value = ''
}

function openCreate() {
  resetForm()
  showCreate.value = true
}

function closeCreate() {
  showCreate.value = false
}

async function loadUsers() {
  listLoading.value = true
  listError.value = ''
  try {
    const res = await request('/api/users')
    users.value = res.data || []
  } catch (e) {
    listError.value = e.message || '加载用户失败'
    if ((e.message || '').includes('重新登录') || (e.message || '').includes('登录已') || (e.message || '').includes('未登录')) {
      router.push('/login')
    }
  } finally {
    listLoading.value = false
  }
}

async function createUser() {
  formError.value = ''
  creating.value = true
  try {
    await request('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username: form.username,
        nickname: form.nickname || null,
        email: form.email || null,
        phone: form.phone || null,
        gender: form.gender
      })
    })
    showCreate.value = false
    resetForm()
    await loadUsers()
  } catch (e) {
    formError.value = e.message || '创建失败'
  } finally {
    creating.value = false
  }
}

async function confirmDelete(item) {
  const ok = window.confirm(`确认删除用户「${item.username}」吗？此操作不可恢复。`)
  if (!ok) return
  deletingId.value = item.id
  try {
    await request('/api/users/' + item.id, { method: 'DELETE' })
    await loadUsers()
  } catch (e) {
    listError.value = e.message || '删除失败'
  } finally {
    deletingId.value = null
  }
}

async function logout() {
  await logoutApi()
  router.push('/login')
}

onMounted(loadUsers)
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 232px 1fr;
  background: #f3f6fb;
  color: #1f2a37;
}

.sidebar {
  background: #0f1b2d;
  color: #d7e6f7;
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
}

.brand {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 10px 22px;
}

.brand-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3aa0ff;
  box-shadow: 0 0 12px rgba(58, 160, 255, 0.8);
}

.brand strong {
  display: block;
  font-size: 16px;
}

.brand p {
  margin: 4px 0 0;
  font-size: 11px;
  color: rgba(180, 210, 235, 0.65);
  letter-spacing: 0.04em;
}

.menu {
  display: grid;
  gap: 6px;
}

.menu-item {
  border: none;
  text-align: left;
  padding: 11px 12px;
  border-radius: 10px;
  background: transparent;
  color: rgba(210, 230, 250, 0.8);
  cursor: pointer;
}

.menu-item.active,
.menu-item:hover {
  background: rgba(58, 160, 255, 0.18);
  color: #fff;
}

.sidebar-foot {
  margin-top: auto;
  padding: 12px;
  font-size: 11px;
  color: rgba(170, 200, 230, 0.55);
  line-height: 1.6;
}

.main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.header {
  height: 68px;
  background: #fff;
  border-bottom: 1px solid #e4ebf3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header h1 {
  margin: 0;
  font-size: 18px;
}

.breadcrumb {
  margin: 4px 0 0;
  font-size: 12px;
  color: #7b8a9a;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #1f8fff;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
}

.account {
  display: grid;
  line-height: 1.2;
}

.account strong {
  font-size: 13px;
}

.account span {
  font-size: 12px;
  color: #7b8a9a;
}

.workspace {
  padding: 20px 24px 32px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 14px;
}

.toolbar h2 {
  margin: 0 0 4px;
  font-size: 20px;
}

.toolbar p {
  margin: 0;
  color: #6b7c8f;
  font-size: 13px;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
}

.table-card {
  background: #fff;
  border: 1px solid #e4ebf3;
  border-radius: 14px;
  overflow: auto;
  box-shadow: 0 8px 24px rgba(31, 50, 80, 0.04);
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 920px;
}

th,
td {
  padding: 12px 14px;
  border-bottom: 1px solid #eef2f7;
  text-align: left;
  font-size: 13px;
  white-space: nowrap;
}

th {
  background: #f8fafc;
  color: #5b6b7c;
  font-weight: 600;
}

.empty {
  text-align: center;
  color: #8a9aab;
  padding: 36px 14px !important;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.tag.ok {
  background: #e8f8ef;
  color: #1f8a4c;
}

.tag.off {
  background: #f3f4f6;
  color: #6b7280;
}

.banner {
  margin: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.banner.error {
  background: #fff1f1;
  color: #b42318;
}

button.primary,
button.secondary,
button.ghost {
  border: none;
  border-radius: 9px;
  padding: 9px 14px;
  font-size: 13px;
  cursor: pointer;
}

button.primary {
  background: #1f8fff;
  color: #fff;
}

button.secondary,
button.ghost {
  background: #fff;
  border: 1px solid #d5dee8;
  color: #486581;
}

button.danger-link {
  border: none;
  background: transparent;
  color: #d92d20;
  cursor: pointer;
  font-size: 13px;
}

button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 50;
}

.modal {
  width: min(560px, 100%);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid #e8eef5;
}

.modal-head h3 {
  margin: 0;
  font-size: 16px;
}

.icon-close {
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: #6b7c8f;
}

.modal-body {
  padding: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

label {
  display: grid;
  gap: 7px;
  font-size: 13px;
  color: #486581;
}

input,
select {
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
}

input:focus,
select:focus {
  border-color: #3b9cff;
  box-shadow: 0 0 0 3px rgba(59, 156, 255, 0.15);
}

.form-error {
  margin: 12px 0 0;
  color: #b42318;
  font-size: 13px;
}

.modal-actions {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    display: none;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
