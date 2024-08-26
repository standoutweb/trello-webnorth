import Trello from 'trello';
import { getWeekNumber, getListIdByName, getCardCreationDate, retryWithDelay } from '../utils/helpers.js';
import axios from "axios";
import { conf } from "../utils/conf.js";

const trello = new Trello( process.env.KEY, process.env.TOKEN );
const retryOptions = { maxRetries: 3, retryDelay: 1000 };

export async function getCreatedCardsCount(weekNumber, boardId) {
	try {
		const cards = await trello.getCardsOnBoard(boardId);
		let valuesArray = [0, 0, 0];
		cards.forEach(card => {
			const cardWeekNumber = getWeekNumber(getCardCreationDate(card.id));
			if (cardWeekNumber === weekNumber - 1) {
				valuesArray[1]++; // created in the previous week
			} else if (cardWeekNumber < weekNumber - 1){
				valuesArray[2]++; // created before the previous week
			}
		});
		valuesArray[0] = await getNewTasksCount(weekNumber);
		return valuesArray;
	} catch (error) {
		console.error('Error fetching cards:', error);
	}
}

export async function getActionsByIdList(lastWeek, idList) {
	return retryWithDelay(async () => {
		try {
			const url = `https://api.trello.com/1/lists/${idList}/actions?key=${process.env.KEY}&token=${process.env.TOKEN}&limit=1000`;
			const response = await axios.get(url);
			const actionsList = response.data;

			const actions = actionsList.filter(action => {
				const actionDate = new Date(action.date);
				return getWeekNumber(actionDate) === lastWeek;
			});
			return actions.length;
		} catch (error) {
			console.error(error);
			throw error; // Ensure the error is rethrown to trigger retry
		}
	}, retryOptions.maxRetries, retryOptions.retryDelay);
}

async function getNewTasksCount(weekNumber) {
	const boardId = conf.DAILY_BOARD_ID;

	//TODO: Improve this function to set listId already in the environment variables
	const listId = await getListIdByName( boardId, 'New Tasks' );
	try {
		const url = `https://api.trello.com/1/lists/${ listId }/actions?key=${ process.env.KEY }&token=${ process.env.TOKEN }&limit=1000`;
		const response = await axios.get( url );
		const actionsList = response.data;

		const cardShortLinks = actionsList
			.filter( action => getWeekNumber( new Date( action.date ) ) === weekNumber )
			.map( action => action.data.card.shortLink );

		const uniqueCardShortLinks = [ ...new Set( cardShortLinks ) ];
		return uniqueCardShortLinks.length;
	} catch ( error ) {
		console.error( error );
	}
}