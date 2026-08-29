import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { WorkspaceGuard } from './workspace.guard';

describe('WorkspaceGuard', () => {
  let guard: WorkspaceGuard;
  let memberService: { getMemberRole: jest.Mock };
  let reflector: { get: jest.Mock };

  beforeEach(() => {
    memberService = { getMemberRole: jest.fn() };
    reflector = { get: jest.fn() };
    guard = new WorkspaceGuard(memberService as any, reflector as any);
  });

  const mockContext = (
    workspaceId: number,
    userId: number,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { workspaceId },
          user: { id: userId },
        }),
      }),
      getHandler: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  it('throws ForbiddenException when member is null', async () => {
    memberService.getMemberRole.mockResolvedValue(null);
    const context = mockContext(1, 41);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when required roles is not satisfied', async () => {
    memberService.getMemberRole.mockResolvedValue('member');
    reflector.get.mockReturnValue(['owner']);
    const context = mockContext(1, 41);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('return true when required roles is stisfied and he is a member', async () => {
    memberService.getMemberRole.mockResolvedValue('owner');
    reflector.get.mockReturnValue(['owner']);
    const context = mockContext(1, 41);

    await expect(guard.canActivate(context)).resolves.toBeTruthy();
  });
});
