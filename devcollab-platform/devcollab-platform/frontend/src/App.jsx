import React, { useEffect, useState } from 'react';
import { supabase } from './main.jsx';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [activity, setActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function api(path, options={}) {
    const token = session?.access_token;
    const r = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers||{}), ...(token ? {Authorization:`Bearer ${token}`} : {}) }});
    if (!r.ok) throw new Error((await r.json()).error || 'Request failed');
    return r.headers.get('content-type')?.includes('csv') ? r.text() : r.json();
  }

  async function loadProject(id) {
    setProjectId(id);
    setTasks(await api(`/api/projects/${id}/tasks`));
    setActivity(await api(`/api/projects/${id}/activity`));
    if (session) {
      const socket = io(API, { auth: { token: session.access_token } });
      socket.on('connect', () => socket.emit('project:join', id));
      socket.on('activity', e => setActivity(a => [e, ...a]));
      return () => socket.disconnect();
    }
  }

  async function search(e) {
    e.preventDefault();
    setResults(await api(`/api/search?q=${encodeURIComponent(query)}`));
  }

  if (!session) return <main className="center"><h1>DevCollab</h1><p>Sign in with your Supabase project to continue.</p><button onClick={() => supabase.auth.signInWithOAuth({provider:'github'})}>Continue with GitHub</button></main>;

  return <div className="app">
    <header><strong>DevCollab</strong><span>{session.user.email}</span><button onClick={() => supabase.auth.signOut()}>Sign out</button></header>
    <aside><h3>Projects</h3>{projects.length ? projects.map(p => <button key={p.id} onClick={() => loadProject(p.id)}>{p.name}</button>) : <small>Load projects through your deployment/API or add a project endpoint.</small>}<h3>Search</h3><form onSubmit={search}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tasks and comments"/><button>Search</button></form></aside>
    <section><h2>{projectId ? 'Project' : 'Welcome'}</h2><div className="grid"><div><h3>Tasks</h3>{tasks.map(t => <article key={t.id}><b>{t.title}</b><span>{t.priority} · {t.status}</span></article>)}</div><div><h3>Activity</h3>{activity.map(a => <article key={a.id}>{a.event_type}</article>)}</div></div>{results && <div><h3>Search Results</h3><pre>{JSON.stringify(results,null,2)}</pre></div>}</section>
  </div>;
}
