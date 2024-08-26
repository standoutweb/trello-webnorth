import axios from 'axios';
import {
	getWeekNumber,
	convertSecondsToMinutes,
	convertMinutesToHours,
	includesTrelloLink,
	retryWithDelay,
	getBudgetHoursOfProjects
} from '../utils/helpers.js';
import { getPaymoAuthHeader } from "../utils/auth.js";
import { conf } from "../utils/conf.js";

const retryOptions = { maxRetries: 3, retryDelay: 1000 };


async function getEntriesForSingleProject( projectId ) {
	return retryWithDelay( async () => {
		try {
			const response = await axios.get( `${ conf.PAYMO_API_URL }/entries?where=project_id=${ projectId }`, {
				headers: { Authorization: getPaymoAuthHeader() }
			} );
			console.log( `Fetched ${ response.data.entries.length } entries for project with ID ${ projectId }` );
			return response.data.entries;
		} catch ( error ) {
			console.error( `Error fetching project with ID ${ projectId }:`, error );
			throw error; // Ensure the error is rethrown to trigger retry
		}
	}, retryOptions.maxRetries, retryOptions.retryDelay );
}

async function getTotalTimeDurationForEntries( entries ) {
	let totalDuration = 0;
	if ( Array.isArray( entries ) ) {
		entries.forEach( entry => {
			if ( entry && typeof entry === 'object' ) {
				totalDuration += entry.duration;
			}
		} );
	}
	return totalDuration;
}

export async function getTotalTimeDuration( entries, weekNumber ) {
	let totalDuration = 0;
	if ( Array.isArray( entries ) ) {
		entries.forEach( entry => {
			if ( entry && typeof entry === 'object' && getWeekNumber( new Date( entry.date ) ) === weekNumber && includesTrelloLink( entry.description ) ) {
				totalDuration += entry.duration;
			}
		} );
	}
	return totalDuration;
}

export async function getBillableHours( lastWeek, projectIds ) {
	let billableTime = 0;

	for ( let projectId of projectIds ) {

		const budgetHours = await retryWithDelay( () => getBudgetHoursOfProjects( projectId ), retryOptions.maxRetries, retryOptions.retryDelay );
		await new Promise( resolve => setTimeout( resolve, 500 ) );

		if ( budgetHours !== null ) {
			const entries = await retryWithDelay( () => getEntriesForSingleProject( projectId ), retryOptions.maxRetries, retryOptions.retryDelay );
			await new Promise( resolve => setTimeout( resolve, 500 ) );
			const totalTime = convertMinutesToHours(
				convertSecondsToMinutes(
					await retryWithDelay( () => getTotalTimeDurationForEntries( entries ), retryOptions.maxRetries, retryOptions.retryDelay )
				)
			);
			const lastWeekTime = convertMinutesToHours(
				convertSecondsToMinutes(
					await retryWithDelay( () => getTotalTimeDuration( entries, lastWeek ), retryOptions.maxRetries, retryOptions.retryDelay )
				)
			);

			if ( budgetHours - ( totalTime - lastWeekTime ) > 0 ) {
				billableTime += Math.min( lastWeekTime, budgetHours - ( totalTime - lastWeekTime ) );
			}
			await new Promise( resolve => setTimeout( resolve, 500 ) );
		}
	}

	return billableTime;
}
