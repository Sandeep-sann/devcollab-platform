import express from 'express';
import cors from 'cors';
import * as Sentry from '@sentry/node';
import { config } from './config.js';
import { requireAuth } from './auth.js';
import { supabase } from './supabase.js';
import { extractMentions } from './services/mentions.js';

if (config.sentryDsn) Sentry.init({ dsn: config.sentryDsn, tracesSampleRate: 0.1 });

export const app = express();
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'devcollab-api' }));

app.get('/api/projects/:projectId/activity', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('project_id', req.params.projectId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/projects/:projectId/tasks', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, task_labels(label_id)')
    .eq('project_id', req.params.projectId)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/projects/:projectId/tasks', requireAuth, async (req, res) => {
  const { title, description = '', priority = 'medium', due_date = null, assignee_id = null, parent_task_id = null } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

  const { data, error } = await supabase.from('tasks').insert({
    project_id: req.params.projectId, title: title.trim(), description, priority,
    due_date, assignee_id, parent_task_id, created_by: req.user.id
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  await supabase.from('activity_events').insert({
    project_id: req.params.projectId, actor_id: req.user.id,
    event_type: 'task.created', payload: { task_id: data.id, title: data.title }
  });
  res.status(201).json(data);
});

app.post('/api/tasks/:taskId/comments', requireAuth, async (req, res) => {
  const { body, parent_comment_id = null } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Comment body is required' });

  const { data: task, error: taskError } = await supabase
    .from('tasks').select('id,project_id,title').eq('id', req.params.taskId).single();
  if (taskError) return res.status(404).json({ error: 'Task not found' });

  const { data: comment, error } = await supabase.from('comments').insert({
    task_id: req.params.taskId, parent_comment_id, author_id: req.user.id, body: body.trim()
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });

  const mentions = extractMentions(body);
  if (mentions.length) {
    const { data: members } = await supabase
      .from('team_members').select('user_id').eq('team_id',
        (await supabase.from('projects').select('team_id').eq('id', task.project_id).single()).data?.team_id
      );
    const ids = new Set((members || []).map(m => m.user_id));
    const { data: users } = await supabase.auth.admin.listUsers();
    const notify = (users?.users || [])
      .filter(u => u.id !== req.user.id && ids.has(u.id) && mentions.includes((u.user_metadata?.username || u.email?.split('@')[0] || '').toLowerCase()))
      .map(u => ({ user_id: u.id, type: 'mention', title: 'You were mentioned', body: `${task.title}: ${body}`, task_id: task.id, comment_id: comment.id }));
    if (notify.length) await supabase.from('notifications').insert(notify);
  }

  await supabase.from('activity_events').insert({
    project_id: task.project_id, actor_id: req.user.id,
    event_type: 'comment.created', payload: { task_id: task.id, comment_id: comment.id }
  });
  res.status(201).json(comment);
});

app.get('/api/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ tasks: [], comments: [] });

  const { data: tasks, error: taskError } = await supabase
    .from('tasks').select('id,project_id,title,description,status,priority')
    .textSearch('search_vector', q, { type: 'websearch', config: 'english' }).limit(50);

  const { data: comments, error: commentError } = await supabase
    .from('comments').select('id,task_id,body,created_at')
    .textSearch('search_vector', q, { type: 'websearch', config: 'english' }).limit(50);

  if (taskError || commentError) return res.status(400).json({ error: taskError?.message || commentError?.message });
  res.json({ tasks, comments });
});

app.get('/api/projects/:projectId/report', requireAuth, async (req, res) => {
  const { data: tasks, error } = await supabase
    .from('tasks').select('assignee_id,status,created_at,completed_at').eq('project_id', req.params.projectId);
  if (error) return res.status(400).json({ error: error.message });

  const byUser = {};
  for (const t of tasks || []) {
    const id = t.assignee_id || 'unassigned';
    byUser[id] ||= { user_id: id, assigned: 0, completed: 0, cycle_days: 0, cycle_count: 0 };
    byUser[id].assigned++;
    if (t.status === 'done') byUser[id].completed++;
    if (t.completed_at) {
      byUser[id].cycle_days += (new Date(t.completed_at) - new Date(t.created_at)) / 86400000;
      byUser[id].cycle_count++;
    }
  }
  const rows = Object.values(byUser).map(x => ({
    ...x,
    completion_rate: x.assigned ? Number((x.completed / x.assigned * 100).toFixed(2)) : 0,
    average_cycle_days: x.cycle_count ? Number((x.cycle_days / x.cycle_count).toFixed(2)) : 0
  }));
  res.json(rows);
});

app.get('/api/projects/:projectId/report.csv', requireAuth, async (req, res) => {
  const { data: tasks, error } = await supabase.from('tasks')
    .select('assignee_id,status,created_at,completed_at').eq('project_id', req.params.projectId);
  if (error) return res.status(400).json({ error: error.message });

  const byUser = {};
  for (const t of tasks || []) {
    const id = t.assignee_id || 'unassigned';
    byUser[id] ||= { assigned: 0, completed: 0, cycle: 0, count: 0 };
    byUser[id].assigned++;
    if (t.status === 'done') byUser[id].completed++;
    if (t.completed_at) {
      byUser[id].cycle += (new Date(t.completed_at) - new Date(t.created_at)) / 86400000;
      byUser[id].count++;
    }
  }
  const lines = ['user_id,assigned,completed,completion_rate,average_cycle_days'];
  for (const [id, x] of Object.entries(byUser)) {
    lines.push(`${id},${x.assigned},${x.completed},${x.assigned ? (x.completed/x.assigned*100).toFixed(2) : 0},${x.count ? (x.cycle/x.count).toFixed(2) : 0}`);
  }
  res.type('text/csv').send(lines.join('\n'));
});

app.use((err, _req, res, _next) => {
  if (config.sentryDsn) Sentry.captureException(err);
  res.status(500).json({ error: 'Internal server error' });
});
