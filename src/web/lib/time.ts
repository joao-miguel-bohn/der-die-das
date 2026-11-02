export { timeAgo } from '@shared/dates'

export const formatDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' })
export const formatDateTime = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
