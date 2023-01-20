import { type MessageEvent, Controller, Sse } from "@nestjs/common";
import { interval, map, Observable } from "rxjs";

import { TrackedEventsService } from "./tracked-events.service";

@Controller("tracked-events")
export class TrackedEventsController {
  constructor(private readonly trackedEventsService: TrackedEventsService) {}

  @Sse("health")
  heartbeatStream(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map((_) => ({ data: { randomNumber: Math.random() } }))
    );
  }

  @Sse("stream")
  trackedEventsStream(): Observable<MessageEvent> {
    return this.trackedEventsService.eventStream$.asObservable().pipe(
      map((trackedEvent) => ({
        id: trackedEvent.id,
        data: {
          kind: trackedEvent.kind,
          createdAt: trackedEvent.createdAt.toISOString(),
          eventData: trackedEvent.eventData,
          trackedAccountId: trackedEvent.trackedAccountId
        }
      }))
    );
  }
}
