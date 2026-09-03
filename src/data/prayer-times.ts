export type TimedItem = {
  name: string;
  time: string;
  note?: string;
};

export type HolidayEvent = {
  name: string;
  time?: string | null;
  note?: string;
};

export type HolidayDay = {
  title: string;
  hebrewDate: string;
  gregorianDate: string;
  events: HolidayEvent[];
  note?: string;
};

export type HolidaySchedule = {
  title: string;
  days: HolidayDay[];
};

export type PrayerSchedule = {
  regularWeekdays: TimedItem[];
  holidays: HolidaySchedule[];
};

export const prayerSchedule: PrayerSchedule = {
  regularWeekdays: [
    { name: "שחרית", time: "06:15" },
    { name: "מנחה", time: "13:30" },
    { name: "ערבית", time: "20:30" },
  ],
  holidays: [
    {
      title: 'ראש השנה תשפ"ז',
      days: [
        {
          title: "ערב ראש השנה",
          hebrewDate: 'יום שישי כ"ט אלול תשפ"ו',
          gregorianDate: "11/09/2026",
          events: [
            { name: "מנחה ערב ראש השנה", time: "18:00" },
            { name: "פיוט אחות קטנה", time: "18:30" },
            { name: "ערבית", time: "19:00" },
          ],
        },
        {
          title: "א' דראש השנה",
          hebrewDate: 'יום שבת א׳ תשרי תשפ"ז',
          gregorianDate: "12/09/2026",
          events: [
            { name: "שחרית", time: "07:30" },
            { name: "מוסף (ללא תקיעות)", time: "09:00" },
            { name: "שיעור חיזוק", time: "17:00" },
            { name: "מנחה ותשליך", time: "17:30" },
            { name: "ערבית", time: "19:10" },
          ],
        },
        {
          title: "ב' דראש השנה",
          hebrewDate: 'יום ראשון ב׳ תשרי תשפ"ז',
          gregorianDate: "13/09/2026",
          events: [
            { name: "שחרית", time: "07:30" },
            { name: "קידוש וכיבוד לפני התקיעות", time: null },
            { name: "תקיעות (משוער)", time: "09:00" },
            { name: "תקיעות נוספות לנשים", time: "11:30" },
            { name: "מנחה", time: "17:30" },
            { name: "ערבית מוצאי ראש השנה", time: "19:10" },
          ],
        },
      ],
    },
    {
      title: 'יום הכיפורים תשפ"ז',
      days: [
        {
          title: "ערב יום הכיפורים",
          hebrewDate: 'יום ראשון ט׳ תשרי תשפ"ז',
          gregorianDate: "20/09/2026",
          events: [
            { name: "מנחה ערב יום הכיפורים", time: "13:00" },
            { name: "כל נדרי", time: "18:00" },
            { name: "ערבית", time: "19:00" },
          ],
        },
        {
          title: "יום הכיפורים",
          hebrewDate: 'יום שני י׳ תשרי תשפ"ז',
          gregorianDate: "21/09/2026",
          events: [
            { name: "שחרית", time: "07:30" },
            { name: "מנחה", time: "13:00" },
            { name: "נעילה", time: "17:00" },
            { name: "ערבית מוצאי יום הכיפורים", time: "19:10" },
            { name: "הבדלה ופתיחת הצום", time: "19:15" },
          ],
          note: "כיבוד ושתיה לרווחת המתפללים ברחבה מחוץ לבית הכנסת",
        },
      ],
    },
  ],
};

export function getPrayerSchedule(): PrayerSchedule {
  return prayerSchedule;
}

export function validatePrayerSchedule(schedule: PrayerSchedule): void {
  schedule.regularWeekdays.forEach((prayer, index) => {
    validateNonEmpty(prayer.name, `regularWeekdays[${index}].name`);
    validateTime(prayer.time, `regularWeekdays[${index}].time`);
  });

  schedule.holidays.forEach((holiday, holidayIndex) => {
    validateNonEmpty(holiday.title, `holidays[${holidayIndex}].title`);

    holiday.days.forEach((day, dayIndex) => {
      const dayPath = `holidays[${holidayIndex}].days[${dayIndex}]`;
      validateNonEmpty(day.title, `${dayPath}.title`);
      validateNonEmpty(day.hebrewDate, `${dayPath}.hebrewDate`);
      validateNonEmpty(day.gregorianDate, `${dayPath}.gregorianDate`);

      day.events.forEach((event, eventIndex) => {
        const eventPath = `${dayPath}.events[${eventIndex}]`;
        validateNonEmpty(event.name, `${eventPath}.name`);

        if (event.time !== undefined && event.time !== null) {
          validateTime(event.time, `${eventPath}.time`);
        }
      });
    });
  });
}

function validateNonEmpty(value: string, path: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Prayer schedule validation failed: ${path} must not be empty.`);
  }
}

function validateTime(value: string, path: string): void {
  if (!isStrictTime(value)) {
    throw new Error(
      `Prayer schedule validation failed: ${path} must use strict 24-hour HH:MM format.`,
    );
  }
}

function isStrictTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
