import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  ProjectCreatedEvent,
  ProjectDeletedEvent,
  ProjectUpdatedEvent,
  TaskCreatedEvent,
  TaskDeletedEvent,
  TaskUpdatedEvent,
  WorkspaceCreatedEvent,
  WorkspaceDeletedEvent,
  WorkspaceUpdatedEvent,
} from './events.event';
import { JwtService } from '@nestjs/jwt';
import { parseCookie } from 'cookie';
import { MemberService } from '../workspace/member/member.service';

interface SocketData {
  userId: number;
}

type AppSocket = Socket<any, any, any, SocketData>;

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway {
  @WebSocketServer()
  server: Server | undefined;

  constructor(
    private readonly memberService: MemberService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(socket: AppSocket) {
    try {
      const parseCookies = parseCookie;
      const cookies = parseCookies(socket.handshake.headers.cookie ?? '');
      const token = cookies['access_token'];

      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ userId: number }>(token);
      socket.data.userId = payload.userId;
    } catch {
      socket.disconnect();
    }
  }

  @SubscribeMessage('workspace.join')
  async handleJoinWorkspace(
    @ConnectedSocket() socket: AppSocket,
    @MessageBody() body: { workspaceId: number },
  ) {
    const userId = socket.data.userId;

    const member = await this.memberService.getMemberRole(
      body.workspaceId,
      userId,
    );

    if (!member) {
      throw new WsException('You are not a member of this workspace');
    }

    const room = `workspace:${body.workspaceId}`;

    await socket.join(room);

    return {
      event: 'workspace.joined',
      data: {
        workspaceId: body.workspaceId,
      },
    };
  }

  @OnEvent('workspace.created')
  handleWorkspaceCreated(event: WorkspaceCreatedEvent) {
    const room = `workspace:${event.workspaceId}`;

    if (!this.server) throw new WsException('no server');

    this.server.to(room).emit('workspace.created', {
      workspace: event.workspace,
      createdAt: event.createdAt,
    });
  }

  @OnEvent('workspace.updated')
  handleWorkspaceUpdated(event: WorkspaceUpdatedEvent) {
    const room = `workspace:${event.workspaceId}`;

    if (!this.server) throw new WsException('no server');

    this.server.to(room).emit('workspace.updated', {
      workspace: event.workspace,
      updatedAt: event.updatedAt,
    });
  }

  @OnEvent('workspace.deleted')
  handleWorkspaceDeleted(event: WorkspaceDeletedEvent) {
    const room = `workspace:${event.workspaceId}`;

    if (!this.server) throw new WsException('no server');

    this.server.to(room).emit('workspace.deleted', {
      workspaceId: event.workspaceIdDeleted,
    });
  }

  @OnEvent('project.created')
  handleProjectCreated(event: ProjectCreatedEvent) {
    const room = `workspace:${event.workspaceId}`;

    if (!this.server) throw new WsException('no server');

    this.server.to(room).emit('project.created', {
      project: event.project,
      createdAt: event.createdAt,
    });
  }

  @OnEvent('project.updated')
  handleProjectUpdated(event: ProjectUpdatedEvent) {
    const room = `workspace:${event.workspaceId}`;

    if (!this.server) throw new WsException('no server');

    this.server.to(room).emit('project.updated', {
      project: event.project,
      updatedAt: event.updatedAt,
    });
  }

  @OnEvent('project.deleted')
  handleProjectDeleted(event: ProjectDeletedEvent) {
    const room = `workspace:${event.workspaceId}`;

    if (!this.server) throw new WsException('no server');

    this.server.to(room).emit('project.deleted', {
      projectId: event.projectId,
    });
  }

  @OnEvent('task.created')
  handleTaskCreated(event: TaskCreatedEvent) {
    const room = `workspace:${event.workspaceId}`;

    if (!this.server) throw new WsException('no server');

    this.server.to(room).emit('task.created', {
      task: event.task,
      createdAt: event.createdAt,
    });
  }

  @OnEvent('task.updated')
  handleTaskUpdated(event: TaskUpdatedEvent) {
    const room = `workspace:${event.workspaceId}`;

    if (!this.server) throw new WsException('no server');

    this.server.to(room).emit('task.updated', {
      task: event.task,
      updatedBy: event.updatedAt,
    });
  }

  @OnEvent('task.delete')
  handleTaskDeleted(event: TaskDeletedEvent) {
    const room = `workspace:${event.workspaceId}`;

    if (!this.server) throw new WsException('no server');

    this.server.to(room).emit('task.deleted', {
      taskId: event.taskId,
    });
  }
}
