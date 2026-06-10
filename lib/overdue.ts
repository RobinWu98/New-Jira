import { query } from "./db";

export async function syncOverdueWorkItems() {
  await query(
    `WITH changed AS (
       UPDATE tasks
       SET status = 'overdue',
           updated_at = now()
       WHERE due_date IS NOT NULL
         AND due_date < current_date
         AND status <> 'done'
         AND status <> 'overdue'
         AND archived_at IS NULL
       RETURNING id, title
     )
     INSERT INTO work_item_logs (task_id, actor_id, action, body)
     SELECT id, NULL, 'status_changed', 'Status changed to overdue because "' || title || '" passed its due date.'
     FROM changed`
  );

  await query(
    `WITH changed AS (
       UPDATE subtasks
       SET status = 'overdue',
           updated_at = now()
       WHERE due_date IS NOT NULL
         AND due_date < current_date
         AND status <> 'done'
         AND status <> 'overdue'
         AND archived_at IS NULL
       RETURNING id, task_id, title
     )
     INSERT INTO work_item_logs (task_id, subtask_id, actor_id, action, body)
     SELECT task_id, id, NULL, 'status_changed', 'Status changed to overdue because "' || title || '" passed its due date.'
     FROM changed`
  );
}
