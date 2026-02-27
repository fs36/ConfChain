import { createRouter, createWebHistory } from "vue-router";
import AppLayout from "../layouts/AppLayout.vue";
import { useAuthStore } from "../stores/auth";

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    roles?: ("ADMIN" | "AUTHOR" | "REVIEWER")[];
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: () => import("../views/LoginView.vue") },
    { path: "/register", component: () => import("../views/RegisterView.vue") },
    {
      path: "/verify",
      component: () => import("../views/VerifyView.vue"),
      meta: { requiresAuth: false },
    },

    {
      path: "/",
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        { path: "", redirect: "/dashboard" },
        {
          path: "dashboard",
          component: () => import("../views/DashboardView.vue"),
        },

        // 管理员路由
        {
          path: "admin/users",
          component: () => import("../views/admin/UserManageView.vue"),
          meta: { requiresAuth: true, roles: ["ADMIN"] },
        },
        {
          path: "admin/reviews",
          component: () => import("../views/admin/ReviewAssignView.vue"),
          meta: { requiresAuth: true, roles: ["ADMIN"] },
        },
        {
          path: "admin/blockchain",
          component: () => import("../views/admin/BlockchainView.vue"),
          meta: { requiresAuth: true, roles: ["ADMIN"] },
        },
        {
          path: "admin/contracts",
          component: () => import("../views/admin/ContractView.vue"),
          meta: { requiresAuth: true, roles: ["ADMIN"] },
        },
        {
          path: "admin/config",
          component: () => import("../views/admin/SystemConfigView.vue"),
          meta: { requiresAuth: true, roles: ["ADMIN"] },
        },

        // 作者路由
        {
          path: "author/papers",
          component: () => import("../views/author/PaperListView.vue"),
          meta: { requiresAuth: true, roles: ["AUTHOR"] },
        },
        {
          path: "author/submit",
          component: () => import("../views/author/PaperSubmitView.vue"),
          meta: { requiresAuth: true, roles: ["AUTHOR"] },
        },

        // 审稿人路由
        {
          path: "reviewer/tasks",
          component: () => import("../views/reviewer/TaskListView.vue"),
          meta: { requiresAuth: true, roles: ["REVIEWER"] },
        },
      ],
    },

    { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
  ],
});

router.beforeEach((to, _from, next) => {
  // 版权存证验证页：所有人可访问，不做登录与权限拦截
  if (to.path === "/verify") {
    return next();
  }

  const auth = useAuthStore();

  if (!to.meta.requiresAuth) {
    if (auth.isLoggedIn && (to.path === "/login" || to.path === "/register")) {
      return next("/dashboard");
    }
    return next();
  }

  if (!auth.isLoggedIn) {
    return next("/login");
  }

  const requiredRoles = to.meta.roles;
  if (requiredRoles && requiredRoles.length > 0) {
    const userRole = auth.profile?.role;
    if (!userRole || !requiredRoles.includes(userRole)) {
      return next("/dashboard");
    }
  }

  next();
});
