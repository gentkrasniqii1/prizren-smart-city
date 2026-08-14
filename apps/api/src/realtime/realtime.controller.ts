import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { REPORT_STATUS_CHANGED_EVENT, StatusChangedEvent } from '../events/status-changed.event';

const STAFF = new Set<string>([Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN]);

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly events: EventEmitter2) {}

  @Get('stream')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  stream(@CurrentUser() user: AuthUser, @Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const handler = (event: StatusChangedEvent) => {
      const allowed = event.ownerUserId === user.id || STAFF.has(user.role);
      if (!allowed) return;
      res.write(`event: report.status\ndata: ${JSON.stringify(event)}\n\n`);
    };

    this.events.on(REPORT_STATUS_CHANGED_EVENT, handler);
    const heartbeat = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      this.events.off(REPORT_STATUS_CHANGED_EVENT, handler);
    });
  }
}
