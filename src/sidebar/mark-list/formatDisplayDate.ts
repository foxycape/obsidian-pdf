const MS_PER_DAY = 86_400_000
const DAYS_WITH_TIME = 30

export type FormatDisplayDateOptions = {
  locale: string
  todayLabel: string
  yesterdayLabel: string
  now?: Date
}

export type DisplayDateText = {
  label: string
  title: string
}

const toValidDate = (input: Date | string | number) => {
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Canonicalize a language tag to BCP 47 casing (zh-cn → zh-CN). */
const toBcp47Locale = (language: string) => {
  const raw = language.trim().replace(/_/g, '-')
  if (!raw) {
    return 'en-US'
  }
  const [languageCode, ...subtags] = raw.split('-').filter(Boolean)
  if (!languageCode) {
    return 'en-US'
  }
  return [
    languageCode.toLowerCase(),
    ...subtags.map((subtag) => {
      if (/^\d{3}$/.test(subtag)) {
        return subtag
      }
      if (subtag.length === 2) {
        return subtag.toUpperCase()
      }
      if (subtag.length === 4) {
        return `${subtag.charAt(0).toUpperCase()}${subtag.slice(1).toLowerCase()}`
      }
      return subtag.toLowerCase()
    }),
  ].join('-')
}

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const formatClock = (date: Date) => {
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${date.getHours()}:${minute}`
}

const formatMonthDay = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)

const formatMonthDayYear = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)

const joinDateAndTime = (datePart: string, clock: string, locale: string) =>
  locale.toLowerCase().startsWith('en') ? `${datePart}, ${clock}` : `${datePart} ${clock}`

/** Same labels as reader: today/yesterday with clock, then month-day, then year. */
export const formatDisplayDate = (
  input: Date | string | number,
  options: FormatDisplayDateOptions,
): DisplayDateText => {
  const date = toValidDate(input)
  if (!date) {
    return { label: '', title: '' }
  }
  const locale = toBcp47Locale(options.locale)
  const now = options.now ?? new Date()
  const clock = formatClock(date)
  const monthDay = formatMonthDay(date, locale)
  const monthDayYear = formatMonthDayYear(date, locale)
  const title = joinDateAndTime(monthDayYear, clock, locale)
  const dayDiff = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / MS_PER_DAY)
  const sameYear = date.getFullYear() === now.getFullYear()
  const withinMonth = dayDiff >= 0 && dayDiff <= DAYS_WITH_TIME

  if (dayDiff === 0) {
    return { label: `${options.todayLabel} ${clock}`, title }
  }
  if (dayDiff === 1) {
    return { label: `${options.yesterdayLabel} ${clock}`, title }
  }
  if (withinMonth) {
    const datePart = sameYear ? monthDay : monthDayYear
    return { label: joinDateAndTime(datePart, clock, locale), title }
  }
  if (sameYear) {
    return { label: monthDay, title }
  }
  return { label: monthDayYear, title }
}
