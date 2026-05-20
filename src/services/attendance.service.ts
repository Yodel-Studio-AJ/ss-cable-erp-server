import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../db/connection';
import { users, subCompanyUsers, attendanceRecords, attendanceSettings } from '../db/schema';
import { AppError } from '../lib/app-error';
import type { AccessTokenPayload } from '../lib/jwt';

// ─── access helpers ───────────────────────────────────────────────────────────

async function getVisibleUserIds(caller: AccessTokenPayload): Promise<string[]> {
  if (caller.role === 'owner') {
    const all = await db.select({ id: users.id }).from(users);
    return all.map((u) => u.id);
  }
  if (caller.subCompanyIds.length === 0) return [caller.sub];
  const rows = await db
    .select({ userId: subCompanyUsers.userId })
    .from(subCompanyUsers)
    .where(inArray(subCompanyUsers.subCompanyId, caller.subCompanyIds));
  const ids = [...new Set(rows.map((r) => r.userId))];
  // always include self
  if (!ids.includes(caller.sub)) ids.push(caller.sub);
  return ids;
}

async function getAlwaysPresentMap(userIds: string[]): Promise<Map<string, boolean>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: attendanceSettings.userId, isAlwaysPresent: attendanceSettings.isAlwaysPresent })
    .from(attendanceSettings)
    .where(inArray(attendanceSettings.userId, userIds));
  return new Map(rows.map((r) => [r.userId, r.isAlwaysPresent]));
}

// ─── month summary ─────────────────────────────────────────────────────────────

export interface DaySummary {
  present:   number;
  absent:    number;
  halfDay:   number;
  leave:     number;
  unmarked:  number;
  total:     number;
}

export interface MonthSummaryResult {
  summary:           Record<string, DaySummary>;
  totalUsers:        number;
  alwaysPresentCount: number;
}

export async function getMonthSummary(
  year: number,
  month: number,
  caller: AccessTokenPayload,
): Promise<MonthSummaryResult> {
  const userIds = await getVisibleUserIds(caller);
  const alwaysPresentMap = await getAlwaysPresentMap(userIds);
  const alwaysPresentCount = [...alwaysPresentMap.values()].filter(Boolean).length;

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDayDate = new Date(year, month, 0);
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

  const records = userIds.length > 0
    ? await db
        .select({ userId: attendanceRecords.userId, date: attendanceRecords.date, status: attendanceRecords.status })
        .from(attendanceRecords)
        .where(and(
          inArray(attendanceRecords.userId, userIds),
          gte(attendanceRecords.date, firstDay),
          lte(attendanceRecords.date, lastDay),
        ))
    : [];

  // Group by date
  const byDate: Record<string, { present: number; absent: number; halfDay: number; leave: number; markedUserIds: Set<string> }> = {};

  for (const rec of records) {
    if (!byDate[rec.date]) {
      byDate[rec.date] = { present: 0, absent: 0, halfDay: 0, leave: 0, markedUserIds: new Set() };
    }
    const d = byDate[rec.date];
    d.markedUserIds.add(rec.userId);
    if (rec.status === 'present') d.present++;
    else if (rec.status === 'absent') d.absent++;
    else if (rec.status === 'half_day') d.halfDay++;
    else if (rec.status === 'leave') d.leave++;
  }

  const summary: Record<string, DaySummary> = {};
  for (const [date, d] of Object.entries(byDate)) {
    const regularMarked = d.markedUserIds.size;
    const unmarked = userIds.length - alwaysPresentCount - regularMarked;
    summary[date] = {
      present:  d.present + alwaysPresentCount,
      absent:   d.absent,
      halfDay:  d.halfDay,
      leave:    d.leave,
      unmarked: Math.max(0, unmarked),
      total:    userIds.length,
    };
  }

  return { summary, totalUsers: userIds.length, alwaysPresentCount };
}

// ─── day attendance ─────────────────────────────────────────────────────────────

export interface DayAttendanceUser {
  userId:          string;
  name:            string;
  role:            string;
  isAlwaysPresent: boolean;
  status:          'present' | 'absent' | 'half_day' | 'leave' | null;
  note:            string | null;
  recordId:        string | null;
}

export async function getDayAttendance(
  date: string,
  caller: AccessTokenPayload,
): Promise<DayAttendanceUser[]> {
  const userIds = await getVisibleUserIds(caller);
  if (userIds.length === 0) return [];

  const [usersData, records, alwaysPresentMap] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(inArray(users.id, userIds)),
    db
      .select()
      .from(attendanceRecords)
      .where(and(inArray(attendanceRecords.userId, userIds), eq(attendanceRecords.date, date))),
    getAlwaysPresentMap(userIds),
  ]);

  const recordMap = new Map(records.map((r) => [r.userId, r]));

  return usersData.map((u) => {
    const record   = recordMap.get(u.id);
    const isAlways = alwaysPresentMap.get(u.id) ?? false;
    return {
      userId:          u.id,
      name:            u.name,
      role:            u.role,
      isAlwaysPresent: isAlways,
      status:          record ? record.status : (isAlways ? 'present' : null),
      note:            record?.note ?? null,
      recordId:        record?.id ?? null,
    };
  });
}

// ─── mark attendance ──────────────────────────────────────────────────────────

export interface MarkRecord {
  userId: string;
  status: 'present' | 'absent' | 'half_day' | 'leave';
  note?:  string | null;
}

export async function markAttendance(
  date: string,
  records: MarkRecord[],
  caller: AccessTokenPayload,
): Promise<number> {
  if (records.length === 0) return 0;

  const visibleIds = await getVisibleUserIds(caller);
  const visibleSet = new Set(visibleIds);

  const unauthorized = records.find((r) => !visibleSet.has(r.userId));
  if (unauthorized) throw new AppError('You cannot mark attendance for one or more of the specified users', 403);

  for (const rec of records) {
    await db
      .insert(attendanceRecords)
      .values({ userId: rec.userId, date, status: rec.status, note: rec.note ?? null, markedById: caller.sub })
      .onConflictDoUpdate({
        target: [attendanceRecords.userId, attendanceRecords.date],
        set: { status: rec.status, note: rec.note ?? null, markedById: caller.sub, updatedAt: new Date() },
      });
  }

  return records.length;
}

// ─── settings ────────────────────────────────────────────────────────────────

export interface AttendanceSettingUser {
  userId:          string;
  name:            string;
  role:            string;
  isAlwaysPresent: boolean;
}

export async function getSettings(caller: AccessTokenPayload): Promise<AttendanceSettingUser[]> {
  const userIds = await getVisibleUserIds(caller);
  if (userIds.length === 0) return [];

  const [usersData, settings] = await Promise.all([
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, userIds)),
    db.select().from(attendanceSettings).where(inArray(attendanceSettings.userId, userIds)),
  ]);

  const settingsMap = new Map(settings.map((s) => [s.userId, s.isAlwaysPresent]));

  return usersData.map((u) => ({
    userId:          u.id,
    name:            u.name,
    role:            u.role,
    isAlwaysPresent: settingsMap.get(u.id) ?? false,
  }));
}

export async function updateSetting(
  targetUserId: string,
  isAlwaysPresent: boolean,
  caller: AccessTokenPayload,
): Promise<void> {
  const visibleIds = await getVisibleUserIds(caller);
  if (!visibleIds.includes(targetUserId)) throw new AppError('User not found', 404);

  await db
    .insert(attendanceSettings)
    .values({ userId: targetUserId, isAlwaysPresent })
    .onConflictDoUpdate({
      target: [attendanceSettings.userId],
      set: { isAlwaysPresent, updatedAt: new Date() },
    });
}
