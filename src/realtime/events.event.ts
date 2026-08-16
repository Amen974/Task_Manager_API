export class WorkspaceCreatedEvent {
  constructor(
    public readonly workspaceId: number,
    public readonly workspace: {
      name: string;
      createdBy: number;
      createdAt: Date;
      updatedAt: Date;
    },
    public readonly createdAt: Date,
  ) {}
}

export class WorkspaceUpdatedEvent {
  constructor(
    public readonly workspaceId: number,
    public readonly workspace: {
      name: string;
      updatedAt: Date;
    },
    public readonly updatedAt: Date,
  ) {}
}

export class WorkspaceDeletedEvent {
  constructor(
    public readonly workspaceId: number,
    public readonly workspaceIdDeleted: number,
  ) {}
}

export class ProjectCreatedEvent {
  constructor(
    public readonly workspaceId: number,
    public readonly project: {
      name: string;
      createdAt: Date;
      updatedAt: Date;
    },
    public readonly createdAt: Date,
  ) {}
}

export class ProjectUpdatedEvent {
  constructor(
    public readonly workspaceId: number,
    public readonly project: {
      name: string;
      updatedAt: Date;
    },
    public readonly updatedAt: Date,
  ) {}
}

export class ProjectDeletedEvent {
  constructor(
    public readonly workspaceId: number,
    public readonly projectId: number,
  ) {}
}

export class TaskCreatedEvent {
  constructor(
    public readonly workspaceId: number,
    public readonly task: {
      title: string;
      instructions: string | null;
      assignedTo: number | null;
      priority: string;
      status: string;
      completedAt: Date | null;
    },
    public readonly createdAt: Date,
  ) {}
}

export class TaskUpdatedEvent {
  constructor(
    public readonly workspaceId: number,
    public readonly task: {
      title: string;
      instructions: string | null;
      assignedTo: number | null;
      priority: string;
      status: string;
      completedAt: Date | null;
    },
    public readonly updatedAt: Date,
  ) {}
}

export class TaskDeletedEvent {
  constructor(
    public readonly workspaceId: number,
    public readonly taskId: number,
  ) {}
}
