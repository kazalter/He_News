import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import GamesView from '../views/GamesView.vue'
import SourcesView from '../views/SourcesView.vue'
import CodesView from '../views/CodesView.vue'
import SettingsView from '../views/SettingsView.vue'
import CalendarView from '../views/CalendarView.vue'
import VersionPlansView from '../views/VersionPlansView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/versions', name: 'versions', component: VersionPlansView },
    { path: '/games', name: 'games', component: GamesView },
    { path: '/calendar', name: 'calendar', component: CalendarView },
    { path: '/sources', name: 'sources', component: SourcesView },
    { path: '/codes', name: 'codes', component: CodesView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
})
