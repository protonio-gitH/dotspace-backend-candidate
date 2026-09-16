import { NextFunction, Request, Response } from 'express';
import { Event, Registration, User, sequelize } from '../models';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function registrationJson(registration: Registration) {
  return {
    id: registration.id,
    eventId: registration.eventId,
    userId: registration.userId,
    createdAt: registration.createdAt,
  };
}

export async function registerForEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  let transaction;

  try {
    const eventId = req.params.eventId as string;
    const { userId } = req.body as { userId?: string };

    if (!UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(userId ?? '')) {
      res.status(400).json({
        error: { code: 'INVALID_ID', message: 'Event and user IDs must be UUIDs' },
      });
      return;
    }

    transaction = await sequelize.transaction();

    const event = await Event.findByPk(eventId, {
      transaction,
      lock: true,
    });

    if (!event) {
      await transaction.rollback();
      res.status(404).json({
        error: { code: 'EVENT_NOT_FOUND', message: 'Event was not found' },
      });
      return;
    }

    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User was not found' },
      });
      return;
    }

    const sameRegistration = await Registration.findOne({
      where: { eventId, userId: user.id },
      transaction,
    });

    if (sameRegistration) {
      await transaction.commit();
      res.status(200).json({
        registration: registrationJson(sameRegistration),
      });
      return;
    }

    const registrationsNow = await Registration.count({
      where: { eventId },
      transaction,
    });

    if (registrationsNow >= event.capacity) {
      await transaction.commit();
      res.status(409).json({
        error: { code: 'EVENT_FULL', message: 'There are no free places' },
      });
      return;
    }

    const created = await Registration.create(
      { eventId, userId: user.id },
      { transaction },
    );

    await transaction.commit();
    res.status(201).json({ registration: registrationJson(created) });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    next(error);
  }
}
