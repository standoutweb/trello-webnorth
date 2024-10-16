import axios from 'axios';
import {
	getWeekNumber,
	convertSecondsToMinutes,
	convertMinutesToHours,
	includesTrelloLink,
	retryWithDelay,
	getBudgetHoursOfProjects,
	getProjects
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

export async function getProjectsContainingVoucher() {
	const excludedProjects = process.env.EXCLUDED_PAYMO_PROJECTS
		? process.env.EXCLUDED_PAYMO_PROJECTS.split(',').map(id => parseInt(id, 10))
		: [];
	const voucherProjectsStatusId = process.env.VOUCHER_PROJECTS_STATUS_ID
		? parseInt(process.env.VOUCHER_PROJECTS_STATUS_ID, 10)
		: '';
	try {
		if ( voucherProjectsStatusId !== '' ) {
			const projects = await getProjects();
			const voucherProjectIds = Object.values(projects)
				.filter(project =>
					!excludedProjects.includes(project.id) &&
					project.status_id === voucherProjectsStatusId &&
					project.active === true)
				.map(project => project.id);
			return voucherProjectIds;
		} else {
			console.error('Status ID for projects not set');
		}
	} catch (error) {
		console.error('Error fetching projects:', error);
		throw error;
	}
}

export async function getListOfProjects() {
	const excludedProjects = process.env.EXCLUDED_PAYMO_PROJECTS
		? process.env.EXCLUDED_PAYMO_PROJECTS.split(',').map(id => parseInt(id, 10))
		: [];

	try {
		const projects = await getProjects();
		const filteredProjects = Object.values(projects)
			.filter(project => !excludedProjects.includes(project.id) && project.active === true)
			.map(project => project.id);
		return filteredProjects;
	} catch (error) {
		console.error('Error fetching projects:', error);
		throw error;
	}
}

export async function getActiveUsersList() {
	try {
		const response = await axios.get(`${conf.PAYMO_API_URL}/users?where=active=true`, {
			headers: { Authorization: getPaymoAuthHeader() }
		});
		const users = response.data.users;
		return users;
	} catch (error) {
		console.error('Error fetching users:', error);
		throw error;
	}
}
export async function getSpendTimeForUser(weekNumber, userId) {

	try {
		const response = await axios.get(`${conf.PAYMO_API_URL}/entries?where=user_id=${userId}`, {
			headers: { Authorization: getPaymoAuthHeader() }
		});
		const entries = response.data.entries;
		const currentYear = new Date().getFullYear();

		const filteredEntries = entries.filter(entry => {
			let entryStart, entryEnd, entryStartWeek, entryEndWeek, entryStartYear, entryEndYear;
			const currentYear = new Date().getFullYear();

			if (entry.start_time && entry.end_time) {
				entryStart = new Date(entry.start_time);
				entryEnd = new Date(entry.end_time);
				entryStartWeek = getWeekNumber(entryStart);
				entryEndWeek = getWeekNumber(entryEnd);
				entryStartYear = entryStart.getFullYear();
				entryEndYear = entryEnd.getFullYear();
			} else if (entry.date) {
				entryStart = new Date(entry.date);
				entryEnd = new Date(entry.date);
				entryStartWeek = getWeekNumber(entryStart);
				entryEndWeek = getWeekNumber(entryEnd);
				entryStartYear = entryStart.getFullYear();
				entryEndYear = entryEnd.getFullYear();
			}

			return (entryStartWeek === weekNumber || entryEndWeek === weekNumber) && (entryStartYear === currentYear || entryEndYear === currentYear);
		});

		const projectTimeMap = filteredEntries.reduce((acc, entry) => {

			if (!acc[entry.project_id]) {
				acc[entry.project_id] = 0;
			}
			acc[entry.project_id] += entry.duration;

			return acc;
		}, {});

		const projectsWithTime = Object.keys(projectTimeMap).map(projectId => ({
			projectId: parseInt(projectId, 10),
			spendTime: convertMinutesToHours(convertSecondsToMinutes(projectTimeMap[projectId]))
		}));
		console.log('projects with time:', projectsWithTime);
		return getBillableHoursForWeek( weekNumber, projectsWithTime );

	} catch (error) {
		console.error('Error fetching projects:', error);
		throw error;
	}
}

export async function getBillableHoursForWeek(weekNumber, projects) {
	let billableTime = 0;
	const excludedProjects = process.env.EXCLUDED_PAYMO_PROJECTS
		? process.env.EXCLUDED_PAYMO_PROJECTS.split(',').map(id => parseInt(id, 10))
		: [];

	for ( let project of projects ) {
		const projectId = project.projectId;
		const projectTime = project.spendTime;
		if (excludedProjects.includes(projectId)) {
			continue;
		}

		const budgetHours = await retryWithDelay( () => getBudgetHoursOfProjects( projectId ), retryOptions.maxRetries, retryOptions.retryDelay );
		await new Promise( resolve => setTimeout( resolve, 1000 ) );

		if ( budgetHours !== null ) {
			const entries = await retryWithDelay( () => getEntriesForSingleProject( projectId ), retryOptions.maxRetries, retryOptions.retryDelay );
			const totalTime = convertMinutesToHours(
				convertSecondsToMinutes(
					await retryWithDelay(() => getTotalTimeDurationUpToWeek(entries, weekNumber), retryOptions.maxRetries, retryOptions.retryDelay)
				)
			);

			if ( budgetHours - ( totalTime - projectTime ) > 0 ) {
				billableTime += Math.min( projectTime, budgetHours - ( totalTime - projectTime ) );
			}
			await new Promise( resolve => setTimeout( resolve, 1000 ) );
		}
	}

	return billableTime;
}

async function getTotalTimeDurationUpToWeek(entries, weekNumber) {
	let totalDuration = 0;
	const currentYear = new Date().getFullYear();

	if (Array.isArray(entries)) {
		entries.forEach(entry => {
			if (entry && typeof entry === 'object') {
				let entryStart, entryEnd, entryStartWeek, entryEndWeek, entryStartYear, entryEndYear;

				if (entry.start_time && entry.end_time) {
					entryStart = new Date(entry.start_time);
					entryEnd = new Date(entry.end_time);
					entryStartWeek = getWeekNumber(entryStart);
					entryEndWeek = getWeekNumber(entryEnd);
					entryStartYear = entryStart.getFullYear();
					entryEndYear = entryEnd.getFullYear();
				} else if (entry.date) {
					entryStart = new Date(entry.date);
					entryEnd = new Date(entry.date);
					entryStartWeek = getWeekNumber(entryStart);
					entryEndWeek = getWeekNumber(entryEnd);
					entryStartYear = entryStart.getFullYear();
					entryEndYear = entryEnd.getFullYear();
				}

				if ((entryStartYear === currentYear || entryEndYear === currentYear) && (entryStartWeek <= weekNumber || entryEndWeek <= weekNumber)) {
					totalDuration += entry.duration;
				}
			}
		});
	}
	return totalDuration;
}

export async function getVouchersRemainingTime(vouchersList, lastWeek){
	if (Array.isArray(vouchersList)) {
		let totalRemainingHours = 0;
		for (const projectId of vouchersList) {
			const budgetHours = await retryWithDelay( () => getBudgetHoursOfProjects( projectId ), retryOptions.maxRetries, retryOptions.retryDelay );
			await new Promise( resolve => setTimeout( resolve, 1000 ) );
			let totalTime = 0;
			if ( budgetHours !== null ) {
				const entries = await retryWithDelay( () => getEntriesForSingleProject( projectId ), retryOptions.maxRetries, retryOptions.retryDelay );
				totalTime = convertMinutesToHours(
					convertSecondsToMinutes(
						await retryWithDelay(() => getTotalTimeDurationUpToWeek(entries, lastWeek), retryOptions.maxRetries, retryOptions.retryDelay)
					)
				);
				await new Promise( resolve => setTimeout( resolve, 1000 ) );
			}
			if(budgetHours - totalTime > 0){
				const remainingHours = budgetHours - totalTime;
				totalRemainingHours += remainingHours;
			}
		}
		return totalRemainingHours;
	}
}