import axios from 'axios';
import {
	getWeekNumber,
	convertSecondsToMinutes,
	convertMinutesToHours,
	includesTrelloLink,
	retryWithDelay,
	getBudgetHoursOfProjects
} from '../utils/helpers';
import { getPaymoAuthHeader } from "../utils/auth";

const retryOptions = { maxRetries: 3, retryDelay: 1000 };

async function getProjectBudgetHoursWithRetry( projectId ) {
	return retryWithDelay( async () => {
		try {
			const response = await axios.get( `${ process.env.PAYMO_API_URL }/projects/${ projectId }`, {
				headers: { Authorization: getPaymoAuthHeader() }
			} );
			const project = response.data.projects[ 0 ];
			console.log( `Fetched project with ID ${ projectId } and budget hours ${ project.budget_hours }` );
			return project.budget_hours;
		} catch ( error ) {
			console.error( `Error fetching project with ID ${ projectId }:`, error );
			throw error; // Ensure the error is rethrown to trigger retry
		}
	}, retryOptions.maxRetries, retryOptions.retryDelay );
}

async function getEntriesForSingleProject( projectId ) {
	return retryWithDelay( async () => {
		try {
			const response = await axios.get( `${ process.env.PAYMO_API_URL }/entries?where=project_id=${ projectId }`, {
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

export async function getTotalTimeDurationForLastWeek( entries, weekNumber ) {
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

export async function getLastWeekBillableHours( projectIds ) {
	let billableTime = 0;

	for ( let projectId of projectIds ) {

		const budgetHours = await retryWithDelay( () => getBudgetHoursOfProjects( projectId ), retryOptions.maxRetries, retryOptions.retryDelay );
		await new Promise( resolve => setTimeout( resolve, 1000 ) );

		if ( budgetHours !== null ) {
			const entries = await retryWithDelay( () => getEntriesForSingleProject( projectId ), retryOptions.maxRetries, retryOptions.retryDelay );
			const totalTime = convertMinutesToHours(
				convertSecondsToMinutes(
					await retryWithDelay( () => getTotalTimeDurationForEntries( entries ), retryOptions.maxRetries, retryOptions.retryDelay )
				)
			);
			const lastWeekTime = convertMinutesToHours(
				convertSecondsToMinutes(
					await retryWithDelay( () => getTotalTimeDurationForLastWeek( entries, getWeekNumber() - 1 ), retryOptions.maxRetries, retryOptions.retryDelay )
				)
			);

			if ( budgetHours - ( totalTime - lastWeekTime ) > 0 ) {
				billableTime += Math.min( lastWeekTime, budgetHours - ( totalTime - lastWeekTime ) );
			}
			await new Promise( resolve => setTimeout( resolve, 1000 ) );
		}
	}

	return billableTime;
}
