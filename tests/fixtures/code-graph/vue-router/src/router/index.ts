import { createRouter, createWebHistory } from 'vue-router';

import Home from '../views/Home.vue';
import { NotFound } from '../views/not-found';

export const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', component: Home },
        { path: '/about', component: () => import('../views/About.vue') },
        { path: '/:pathMatch(.*)*', component: NotFound },
        { path: '/old', redirect: '/' },
    ],
});

export const api = { path: '/v1', timeout: 3000 };
