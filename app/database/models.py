from sqlalchemy.orm import declarative_base, relationship, mapped_column, Mapped
from sqlalchemy import String, Integer, DateTime, Boolean, ForeignKey, Enum as SQLEnum, Text
import enum
import datetime

Base = declarative_base()

class ReminderStatus(enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DISABLED = "disabled"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    username: Mapped[str] = mapped_column(String(255), nullable=True)
    first_name: Mapped[str] = mapped_column(String(255), nullable=True)
    timezone: Mapped[str] = mapped_column(String(100), default="Asia/Jakarta")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    reminders = relationship("Reminder", back_populates="user")


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="Lainnya")
    priority: Mapped[str] = mapped_column(String(50), default="Medium")
    schedule_type: Mapped[str] = mapped_column(String(50), default="One-time")
    scheduled_at: Mapped[datetime.datetime] = mapped_column(DateTime, index=True)
    timezone: Mapped[str] = mapped_column(String(100))
    recurrence_rule: Mapped[str] = mapped_column(String(255), nullable=True)
    start_date: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    occurrence_limit: Mapped[int] = mapped_column(Integer, nullable=True)
    status: Mapped[ReminderStatus] = mapped_column(SQLEnum(ReminderStatus), default=ReminderStatus.ACTIVE, index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="reminders")
    logs = relationship("ReminderLog", back_populates="reminder")


class ReminderLog(Base):
    __tablename__ = "reminder_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reminder_id: Mapped[int] = mapped_column(Integer, ForeignKey("reminders.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    scheduled_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    executed_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, index=True)

    reminder = relationship("Reminder", back_populates="logs")
