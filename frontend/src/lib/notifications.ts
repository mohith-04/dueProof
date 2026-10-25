export type NotificationItem = {
  id: number
  kind: 'reminder' | 'overdue'
  message: string
  occurrence_id: number
  due_date: string
  /** The item has since been marked done. */
  resolved: boolean
  read: boolean
  created_at: string
}

export type NotificationFeed = {
  unread_count: number
  items: NotificationItem[]
}
