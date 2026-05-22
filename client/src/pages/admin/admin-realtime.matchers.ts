import type { AdminRealtimeEventType } from '../../hooks/useAdminRealtime'

const match = (type: AdminRealtimeEventType, expected: AdminRealtimeEventType[]) => expected.includes(type)

export function shouldRefreshOverview(type: AdminRealtimeEventType) {
  return match(type, [
    'admin:overview-updated',
    'admin:schools-updated',
    'admin:subscriptions-updated',
    'admin:support-updated',
    'admin:users-updated',
    'admin:activity-updated',
  ])
}

export function shouldRefreshSchools(type: AdminRealtimeEventType) {
  return match(type, [
    'admin:schools-updated',
    'admin:subscriptions-updated',
    'admin:overview-updated',
  ])
}

export function shouldRefreshSubscriptions(type: AdminRealtimeEventType) {
  return match(type, [
    'admin:subscriptions-updated',
    'admin:schools-updated',
    'admin:overview-updated',
  ])
}

export function shouldRefreshUsers(type: AdminRealtimeEventType) {
  return match(type, [
    'admin:users-updated',
    'admin:overview-updated',
  ])
}

export function shouldRefreshSupport(type: AdminRealtimeEventType) {
  return match(type, [
    'admin:support-updated',
    'admin:overview-updated',
  ])
}

export function shouldRefreshActivity(type: AdminRealtimeEventType) {
  return match(type, [
    'admin:activity-updated',
    'admin:schools-updated',
    'admin:subscriptions-updated',
    'admin:support-updated',
    'admin:overview-updated',
  ])
}
