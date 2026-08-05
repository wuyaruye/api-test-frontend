import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import AdminView from '../views/AdminView.vue'
import { isAuthenticated } from '../api/http'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'login', component: LoginView, meta: { guest: true } },
    { path: '/admin', name: 'admin', component: AdminView, meta: { requiresAuth: true } }
  ]
})

router.beforeEach((to) => {
  const authed = isAuthenticated()
  if (to.meta.requiresAuth && !authed) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guest && authed) {
    return { path: '/admin' }
  }
})

export default router
