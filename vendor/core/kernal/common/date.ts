import { isNumber } from "./number";

/**
 * Get a friendly relative time (e.g. a few seconds ago, a few minutes ago)
 */
export const getFriendlyDate = (date: Date, language: string) => {
    if (!date)
        return "";
    if (!(date instanceof Date) || typeof date != "object") {
        try {
            date = new Date(date);
        }
        catch (e) {
            return "";
        }
    }
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    let interval: number
    if (diff < 10000) {
        return language == "zh-cn" ? "刚刚" : "just now";
    } else if (diff < 60000) {
        interval = Math.floor(diff / 1000)
        return `${interval}` + (language == "zh-cn" ? "秒前" : " second" + (interval == 1 ? '' : 's') + " ago");
    } else if (diff < 3600000) {
        interval = Math.floor(diff / 60000)
        return `${interval}` + (language == "zh-cn" ? "分钟前" : " minute" + (interval == 1 ? '' : 's') + " ago");
    } else if (diff < 86400000) {
        interval = Math.floor(diff / 3600000)
        return `${interval}` + (language == "zh-cn" ? "小时前" : " hour" + (interval == 1 ? '' : 's') + " ago");
    } else {
        const totalDays = Math.floor(diff / 86400000);
        if (totalDays >= 365) {
            return date.toLocaleDateString();
        }
        if (totalDays >= 30) {
            interval = Math.floor(totalDays / 30)
            return `${interval}` + (language == "zh-cn" ? "个月前" : " month" + (interval == 1 ? '' : 's') + " ago");
        }
        return `${totalDays}` + (language == "zh-cn" ? "天前" : " day" + (totalDays == 1 ? '' : 's') + " ago");
    }
};

/**
 * Format a date as yyyy-MM-dd HH:mm:ss
 */
export const formatDate = (date: Date, utc: boolean, onlyDate?: boolean) => {
    if (!date)
        return "";
    if (!(date instanceof Date) || typeof date != "object") {
        try {
            date = new Date(date);
        }
        catch (e) {
            return "";
        }
    }
    const year = utc ? date.getUTCFullYear() : date.getFullYear();
    const month = utc ? date.getUTCMonth() + 1 : date.getMonth() + 1;
    const d = utc ? date.getUTCDate() : date.getDate();

    const hour = utc ? date.getUTCHours() : date.getHours();
    const minute = utc ? date.getUTCMinutes() : date.getMinutes();
    const second = utc ? date.getUTCSeconds() : date.getSeconds();

    let monthString = month.toString();
    if (month < 10) {
        monthString = "0" + month;
    }

    let dayString = d.toString();
    if (d < 10) {
        dayString = "0" + d;
    }
    let hourString = hour.toString();
    if (hour < 10) {
        hourString = "0" + hour;
    }
    let minuteString = minute.toString();
    if (minute < 10) {
        minuteString = "0" + minute;
    }
    let secondString = second.toString();
    if (second < 10) {
        secondString = "0" + second;
    }
    if (onlyDate) {
        return year + "-" + monthString + "-" + dayString;
    }
    return year + "-" + monthString + "-" + dayString + " " + hourString + ":" + minuteString + ":" + secondString;
};

/**
 * Convert a string to a Date
 */
export const convertToDate = (date: Date | string, defaultValue?: Date) => {
    let newDate: Date;
    if (date) {
        if (date instanceof Date) {
            return date;
        }
        newDate = new Date(date)
        if (!isNumber(newDate.getTime())) {
            if (defaultValue) {
                return defaultValue;
            }
            return null;
        }
        return newDate;
    }
    else if (defaultValue) {
        return defaultValue;
    }
    return null;
};
