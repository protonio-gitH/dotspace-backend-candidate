import { NextFunction, Request, Response } from 'express';
import { Event, Registration } from '../models';
import { presentOldEvent } from '../legacy/event-presenter';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listEvents(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const allEvents = await Event.findAll({ order: [['title', 'ASC']] });

    // This intentionally uses the old presenter and one count per event.
    const result = await Promise.all(
      allEvents.map(async (event) => {
        const peopleAlreadyIn = await Registration.count({
          where: { eventId: event.id },
        });

        return presentOldEvent(event, peopleAlreadyIn);
      }),
    );

    res.json({ events: result });
  } catch (error) {
    next(error);
  }
}

export async function getEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params.eventId as string;

    if (!UUID_PATTERN.test(eventId)) {
      res.status(400).json({
        error: { code: 'INVALID_ID', message: 'Event ID must be a UUID' },
      });
      return;
    }

    const event = await Event.findByPk(eventId);

    if (!event) {
      res.status(404).json({
        error: { code: 'EVENT_NOT_FOUND', message: 'Event was not found' },
      });
      return;
    }

    const registeredCount = await Registration.count({
      where: { eventId: event.id },
    });

    // Kept separate from presentOldEvent for historical reasons.
    res.json({
      event: {
        id: event.id,
        title: event.title,
        capacity: event.capacity,
        status: event.status,
        registeredCount,
        freePlaces: Math.max(event.capacity - registeredCount, 0),
        createdAt: event.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
