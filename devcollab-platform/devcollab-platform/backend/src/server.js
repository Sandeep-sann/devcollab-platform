import http from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { config } from './config.js';
import { supabase } from './supabase.js';

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: config.frontendUrl } });

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token || !supabase) return next(new Error('Unauthorized'));
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return next(new Error('Unauthorized'));
  socket.user = data.user;
  next();
});

io.on('connection', socket => {
  socket.on('project:join', async projectId => {
    const { data: project } = await supabase.from('projects').select('team_id').eq('id', projectId).single();
    if (!project) return;
    const { data: member } = await supabase.from('team_members').select('user_id')
      .eq('team_id', project.team_id).eq('user_id', socket.user.id).maybeSingle();
    if (member) socket.join(`project:${projectId}`);
  });
});

httpServer.listen(config.port, () => console.log(`DevCollab API listening on ${config.port}`));
