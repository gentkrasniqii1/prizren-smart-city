import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { RealtimeEvent } from '@prizren/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Get('stream')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  async stream(@CurrentUser() user: AuthUser, @Req() req: Request, @Res() res: Response) {
    const audience = await this.realtime.loadAudience(user);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    this.write(res, 'ready', { ok: true });

    const unsubscribe = this.realtime.subscribe((event: RealtimeEvent) => {
      if (!this.realtime.visibleTo(audience, event)) return;
      this.write(res, event.type, event);
    });

    const heartbeat = setInterval(() => {
      if (res.writableEnded) return;
      res.write(`: ping\n\n`);
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
  }

  private write(res: Response, event: string, data: unknown) {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}
