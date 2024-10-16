import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from "axios";
import { getPaymoAuthHeader } from "./auth.js";
import { conf } from "./conf.js";
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.join(__dirname, '..', 'cache');

export async function readCache(fileName) {
	const filePath = path.join(cacheDir, fileName);
	try {
		const data = await fs.readFile(filePath, 'utf-8');
		return JSON.parse(data);
	} catch (error) {
		return {};
	}
}

export async function writeCache(fileName, data) {
	const filePath = path.join(cacheDir, fileName);
	try {
		// Ensure the cache directory exists
		await fs.mkdir(cacheDir, { recursive: true });
		await fs.writeFile(filePath, JSON.stringify(data, null, 2));
	} catch (error) {
		console.error(`Error writing cache file ${filePath}:`, error);
	}
}

export async function deleteCache(fileName) {
	const filePath = path.join(cacheDir, fileName);
	await fs.unlink(filePath);
}

export function getWeekNumber(d = new Date()) {
	d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil( ( ( ( d - yearStart ) / 86400000 ) + 1 ) / 7 );
}

export function getStartAndEndDate(weekNumber) {
	const today = new Date();
	const year = today.getFullYear();
	const startDate = new Date(year, 0, 1);
	const endDate = new Date(year, 0, 1);
	const days = 7 * (weekNumber - 1);
	startDate.setDate(startDate.getDate() + days);
	endDate.setDate(endDate.getDate() + days + 6);
	return { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] };
}

export function convertSecondsToMinutes(seconds) {
	return seconds / 60;
}

export function convertMinutesToHours(minutes) {
	return minutes / 60;
}

export function includesTrelloLink(description) {
	const trelloLinkRegex = /trello.com\/c\/[a-zA-Z0-9]+/g;
	return trelloLinkRegex.test(description);
}

export function getListIdByName( boardId, listName ) {
	const url = `https://api.trello.com/1/boards/${ boardId }/lists?key=${ process.env.KEY }&token=${ process.env.TOKEN }`;
	return axios.get( url )
		.then( response => {
			const lists = response.data;
			const matchingList = lists.find( list => list.name === listName );
			return matchingList ? matchingList.id : null;
		} )
		.catch( error => {
			console.error( error );
		} );
}

export function getCardCreationDate(cardId) {
	const timestamp = parseInt(cardId.substring(0,8), 16);
	return new Date( timestamp * 1000 );
}

export async function retryWithDelay(fn, retries, delay) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			if (attempt === retries) {
				await new Promise(resolve => setTimeout(resolve, delay));
				throw error;
			}
		}
	}
}

export async function fetchBoardSeconds(boardId, weekNumber) {
	return retryWithDelay(async () => {
		const response = await axios.get(`${process.env.API_URL}/boards/${boardId}/${weekNumber}/seconds`, {
			params: { secret: process.env.SECRET_QUERY_PARAM_VALUE }
		});
		return response.data;
	}, 3, 2000);
}

export async function fetchGoogleUpdate(weekNumber, timeInSeconds) {
	return retryWithDelay(async () => {
		const response = await axios.get(`${process.env.API_URL}/google/${weekNumber}/${timeInSeconds}/`, {
			params: { secret: process.env.SECRET_QUERY_PARAM_VALUE }
		});
		console.log(`Fetched Google update for week ${weekNumber} and time ${timeInSeconds}`);
		return response.data;
	}, 3, 1000);
}

async function fetchAllProjects() {
	const response = await axios.get(`${conf.PAYMO_API_URL}/projects`, {
		headers: { Authorization: getPaymoAuthHeader() }
	});

	let projects = response.data.projects;
	projects.forEach(project => {
		if (project.budget_hours === null) {
			project.budget_hours = 0;
		}
		projects[project.id] = project;
	});

	return response.data.projects;
}

export async function getProjects() {
	let cache = await readCache('projects.json');

	if (Object.keys(cache).length === 0) {
		const allProjects = await fetchAllProjects();
		allProjects.forEach(project => {
			if (project.budget_hours === null) {
				project.budget_hours = 0;
			}
			cache[project.id] = project;
		});
		writeCache('projects.json', cache);
	}

	return cache;
}

export async function getBudgetHoursOfProjects( projectId ) {
	try {
		let projects = await getProjects();

		if (projects[projectId]) {
			return projects[projectId].budget_hours;
		} else {
			console.error(`Project ID ${projectId} not found in cache.`);
			return null;
		}
	} catch (error) {
		console.error(`Error fetching project with ID ${projectId}:`, error);
	}
}