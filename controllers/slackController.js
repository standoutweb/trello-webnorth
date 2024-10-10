import { conf } from "../utils/conf.js";

export function createSummaryMessage(weekNumber, data) {
    const firstSheetMessage = `For week ${weekNumber}, the total time spent on daily cards was ${convertMinutesToHours(convertSecondsToMinutes(data.dailyTimeInSeconds))} hours. A total of ${data.dailyCreatedCardsCount} cards were created, with ${data.tasksMovedToDone} cards moved to done. The invoiceable time was ${data.billableTime} hours, and the invoiceable time just for vouchers was ${data.vouchersBillableTime} hours.`;

    const secondSheetMessage = `For week ${weekNumber + 1}, the remaining voucher hours were ${data.vouchersRemaining} hours (${data.voucherRemainingTimePerUser} hours per user). The invoiceable time for all boards was ${data.allProjectsBillableTime} hours.`;

    return `${firstSheetMessage}\n\n${secondSheetMessage}`;
}