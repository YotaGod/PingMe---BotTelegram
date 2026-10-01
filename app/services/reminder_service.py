from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import Optional, List
from app.database.models import Reminder, User, ReminderStatus
import logging

logger = logging.getLogger(__name__)

async def get_or_create_user(session: AsyncSession, telegram_id: int, username: str, first_name: str) -> User:
    result = await session.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(telegram_id=telegram_id, username=username, first_name=first_name)
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user

async def create_reminder(
    session: AsyncSession,
    user_id: int,
    title: str,
    message: str,
    category: str,
    priority: str,
    schedule_type: str,
    scheduled_at: datetime,
    timezone: str
) -> Reminder:
    reminder = Reminder(
        user_id=user_id,
        title=title,
        message=message,
        category=category,
        priority=priority,
        schedule_type=schedule_type,
        scheduled_at=scheduled_at,
        timezone=timezone,
        status=ReminderStatus.ACTIVE
    )
    session.add(reminder)
    await session.commit()
    await session.refresh(reminder)
    return reminder

async def get_active_reminders(session: AsyncSession) -> List[Reminder]:
    result = await session.execute(
        select(Reminder).where(Reminder.status == ReminderStatus.ACTIVE)
    )
    return list(result.scalars().all())

async def update_reminder_status(session: AsyncSession, reminder_id: int, status: ReminderStatus):
    result = await session.execute(select(Reminder).where(Reminder.id == reminder_id))
    reminder = result.scalar_one_or_none()
    if reminder:
        reminder.status = status
        await session.commit()

async def get_reminder(session: AsyncSession, reminder_id: int) -> Optional[Reminder]:
    result = await session.execute(
        select(Reminder)
        .options(selectinload(Reminder.user))
        .where(Reminder.id == reminder_id)
    )
    return result.scalar_one_or_none()

async def get_user_active_reminders(session: AsyncSession, user_id: int) -> List[Reminder]:
    result = await session.execute(
        select(Reminder)
        .where(Reminder.user_id == user_id, Reminder.status == ReminderStatus.ACTIVE)
        .order_by(Reminder.scheduled_at)
    )
    return list(result.scalars().all())


async def cancel_user_reminders(
    session: AsyncSession, user_id: int, reminder_ids: List[int]
) -> int:
    if not reminder_ids:
        return 0

    result = await session.execute(
        update(Reminder)
        .where(
            Reminder.user_id == user_id,
            Reminder.id.in_(reminder_ids),
            Reminder.status == ReminderStatus.ACTIVE,
        )
        .values(status=ReminderStatus.CANCELLED)
    )
    await session.commit()
    return result.rowcount or 0

async def get_user_reminders_today(session: AsyncSession, user_id: int, start_of_day: datetime, end_of_day: datetime) -> List[Reminder]:
    result = await session.execute(
        select(Reminder)
        .where(
            Reminder.user_id == user_id, 
            Reminder.status == ReminderStatus.ACTIVE,
            Reminder.scheduled_at >= start_of_day,
            Reminder.scheduled_at <= end_of_day
        )
        .order_by(Reminder.scheduled_at)
    )
    return list(result.scalars().all())
