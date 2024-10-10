import express from 'express';
import Trello from "trello";
import requireAuth from '../middlewares/requireAuth.js';
import { getPaymoAuthHeader } from '../utils/auth.js';
import { getCreatedCardsCount, getActionsByIdList } from '../controllers/trelloController.js';
import { getBillableHours, getProjectsContainingVoucher, getActiveUsersList, getSpendTimeForUser, getListOfProjects, getVouchersRemainingTime } from '../controllers/paymoController.js';
//import { createSummaryMessage } from '../controllers/slackController.js';
import { saveDataToSpreadsheet, connectToSpreadsheet } from '../utils/googleSheets.js';
import {
	convertSecondsToMinutes,
	convertMinutesToHours,
	getWeekNumber,
	includesTrelloLink,
	getStartAndEndDate,
	fetchBoardSeconds,
	fetchGoogleUpdate,
	deleteCache
} from '../utils/helpers.js';
import axios from "axios";
import { conf } from "../utils/conf.js";

const router = express.Router();
const trello = new Trello( process.env.KEY, process.env.TOKEN );
let endRow = 0;

// Existing Trello integration routes
router.get( '/boards', requireAuth, async ( req, res ) => {
	try {
		const boards = await trello.getBoards( 'me' );
		res.json( boards );
	} catch ( error ) {
		res.status( 500 ).send( error.toString() );
	}
} );
router.get( '/boards/:boardId/cards', requireAuth, async ( req, res ) => {
	try {
		const { boardId } = req.params;
		const cards = await trello.getCardsOnBoard( boardId );
		res.json( cards );
	} catch ( error ) {
		res.status( 500 ).send( error.toString() );
	}
} );
router.get( '/cards/:cardId/actions', requireAuth, async ( req, res ) => {
	try {
		const actions = await trello.getActionsOnCard( req.params.cardId );
		res.json( actions );
	} catch ( error ) {
		res.status( 500 ).send( error.toString() );
	}
} );
router.get( '/paymo/timelogs/:startDate/:endDate', requireAuth, async ( req, res ) => {
	let { startDate, endDate } = req.params;

	try {
		const [ entries, users ] = await Promise.all( [
			axios.get( `${ conf.PAYMO_API_URL }/entries`, {
				headers: { Authorization: getPaymoAuthHeader() },
				params: {
					where: `time_interval in ("${ startDate }","${ endDate }")`
				}
			} ),

			axios.get( `${ conf.PAYMO_API_URL }/users`, {
				headers: { Authorization: getPaymoAuthHeader() }
			} )
		] )

		const entriesData = entries.data.entries;
		const usersData = users.data.users;

		const entriesWithUserNames = entriesData.map( entry => {
			const user = usersData.find( user => user.id === entry.user_id );
			return { ...entry, user_name: user.name };
		} );

		res.json( entriesWithUserNames );

	} catch ( error ) {
		console.error( error );
	}

} );
// get hours worked on specific week and specific board
router.get( '/boards/:boardId/:weekNumber/seconds', requireAuth, async ( req, res ) => {
	const { boardId, weekNumber } = req.params;
	let secretToken = req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE ? process.env.SECRET_QUERY_PARAM_VALUE : null;

	try {
		const entries = await axios.get( `${ process.env.API_URL }/paymo/${ weekNumber }/${ boardId }/timelogs`, {
			params: { secret: secretToken }
		} );

		const timeInSeconds = entries.data.reduce( ( total, entry ) => total + entry.duration, 0 );
		const projectIds = entries.data.map( entry => entry.project_id );
		res.json( { timeInSeconds, projectIds } );

	} catch ( error ) {
		console.error( error );
		res.status( 500 ).send( error.toString() );
	}
} );
router.get( '/paymo/:weekNumber/:boardId/timelogs/', requireAuth, async ( req, res ) => {
	const { boardId, weekNumber } = req.params;

	const { startDate, endDate } = getStartAndEndDate( weekNumber );

	const [ timelogResponse, cardsResponse ] = await Promise.all( [
		axios.get( `${ process.env.API_URL }/paymo/timelogs/${ startDate }/${ endDate }`, {
			params: { secret: process.env.SECRET_QUERY_PARAM_VALUE }
		} ),
		axios.get( `${ process.env.API_URL }/boards/${ boardId }/cards`, {
			params: { secret: process.env.SECRET_QUERY_PARAM_VALUE }
		} )
	] );

	let entries = timelogResponse.data;

	if ( ! Array.isArray( entries ) ) {
		throw new TypeError( 'Expected entries to be an array' );
	}

	const cards = cardsResponse.data;
	entries = entries.filter( entry => entry.description && includesTrelloLink( entry.description ) );

	entries = entries.map( entry => {
		const match = entry.description.match( /\/c\/[a-zA-Z0-9]+/ );
		if ( ! match ) return entry;
		const shortLink = match[ 0 ].split( '/' )[ 2 ];
		return { ...entry, shortLink };
	} );

	const matchedEntries = entries.filter( entry => cards.some( card => card.shortLink === entry.shortLink ) );

	res.json( matchedEntries );
} );
router.get('/last-week-hours-daily-send-to-sheets', requireAuth, async (req, res) => {
	const lastWeek = getWeekNumber() - 1;
	const boardId = conf.DAILY_BOARD_ID;
	const doneBoardId = conf.DONE_BOARD_ID;
	const listId = conf.DONE_LIST_ID;
	endRow = 0;

	try {

		const { timeInSeconds: dailyTimeInSeconds, projectIds: dailyProjectIds } = await fetchBoardSeconds(boardId, lastWeek);
		new Promise(resolve => setTimeout(resolve, 500));
		const { timeInSeconds: doneTimeInSeconds, projectIds: doneProjectIds } = await fetchBoardSeconds(doneBoardId, lastWeek);

		// Sum up time in seconds for both boards
		const totalTimeInSeconds = dailyTimeInSeconds + doneTimeInSeconds;

		console.log('Total Time in seconds:', totalTimeInSeconds);
		console.log('Project IDs:', dailyProjectIds, doneProjectIds)
		const googleResponse = await fetchGoogleUpdate(lastWeek, totalTimeInSeconds);
		console.log('Google response:', googleResponse);

		let uniqueProjectIds = [...new Set([...dailyProjectIds, ...doneProjectIds])];
		if( conf.EXCLUDED_PAYMO_PROJECTS ) {
			const excludeProjectIds = conf.EXCLUDED_PAYMO_PROJECTS.split(',').map(Number);
			uniqueProjectIds = uniqueProjectIds.filter(projectId => !excludeProjectIds.includes(projectId));
		}
		console.log('Unique project IDs:', uniqueProjectIds)
		const billableTime = await getBillableHours(lastWeek,uniqueProjectIds);
		let billableTimeArray = [billableTime];
		console.log('Billable time:', billableTime);
		await saveDataToSpreadsheet('G', billableTimeArray);

		const tasksMovedToDone = await getActionsByIdList(lastWeek, listId);
		let tasksMovedToDoneArray = [tasksMovedToDone];
		await saveDataToSpreadsheet('F', tasksMovedToDoneArray);

		const dailyCreatedCardsCount = await getCreatedCardsCount(lastWeek, boardId);
		await saveDataToSpreadsheet('C', dailyCreatedCardsCount);

		const vouchersList = await getProjectsContainingVoucher();
		const vouchersBillableTime = await getBillableHours(lastWeek, vouchersList);
		let vouchersBillableTimeArray = [vouchersBillableTime];
		console.log('Vouchers billable time:', vouchersBillableTime);
		await saveDataToSpreadsheet('H', vouchersBillableTimeArray);

		const allProjectsList = await getListOfProjects();
		const allProjectsBillableTime = await getBillableHours(lastWeek, allProjectsList);
		let allProjectsBillableTimeArray = [allProjectsBillableTime];
		console.log('All projects billable time:', allProjectsBillableTime);
		await saveDataToSpreadsheet('C', allProjectsBillableTimeArray, 'Overall stats');

		const voucherRemainingTimePerUser = allProjectsBillableTime/19;
		let vouchersRemainingArray = [voucherRemainingTimePerUser];
		console.log('Invoicable time per person:', voucherRemainingTimePerUser);
		await saveDataToSpreadsheet('B', vouchersRemainingArray, 'Overall stats');

		/*const message = createSummaryMessage(lastWeek, {
			dailyTimeInSeconds,
			dailyCreatedCardsCount,
			tasksMovedToDone,
			billableTime,
			vouchersBillableTime,
			vouchersRemaining,
			voucherRemainingTimePerUser,
			allProjectsBillableTime
		});*/

		//delete the cache
		await deleteCache('projects.json');

		res.json({
			totalTimeInSeconds,
			billableTime,
			tasksMovedToDone,
			dailyCreatedCardsCount,
		});
	} catch (error) {
		console.error(error);
		res.status(500).send(error.toString());
	}
});

router.get( '/cards/:cardShortLink/:pagination/timelogs', requireAuth, async ( req, res ) => {
	try {
		const { cardShortLink, pagination } = req.params;

		// Set start and end dates for the first page to include tomorrow
		let startDate, endDate;
		if ( pagination === '1' ) {
			endDate = new Date();
			endDate.setDate( endDate.getDate() + 1 ); // Set endDate to tomorrow
			startDate = new Date( endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 30 );
		} else {
			endDate = new Date();
			endDate.setDate( endDate.getDate() - ( 30 * ( pagination - 1 ) ) );
			startDate = new Date();
			startDate.setDate( startDate.getDate() - ( 30 * pagination ) );
		}

		// paymo api only accepts dates in the format YYYY-MM-DD
		const formattedStartDate = startDate.toISOString().split( 'T' )[ 0 ];
		const formattedEndDate = endDate.toISOString().split( 'T' )[ 0 ];

		const entries = await axios.get( `${ process.env.API_URL }/paymo/timelogs/${ formattedStartDate }/${ formattedEndDate }`, {
			params: {
				secret: process.env.SECRET_QUERY_PARAM_VALUE,
			}
		} );

		// remove entries that don't have the card short link in the description
		const cardEntries = entries.data.filter( entry => entry.description && includesTrelloLink( entry.description ) && entry.description.includes( cardShortLink ) );

		res.json( cardEntries );
	} catch ( error ) {
		console.error( 'Error fetching time logs:', error );
		res.status( 500 ).json( { error: 'Internal Server Error' } );
	}
} );
router.get( '/paymo/task/:taskID', requireAuth, async ( req, res ) => {
	const { taskID } = req.params;
	try {
		const task = await axios.get( `${ conf.PAYMO_API_URL }/tasks/${ taskID }`, {
			headers: { Authorization: getPaymoAuthHeader() }
		} );

		res.json( task.data.tasks[ 0 ] );
	} catch ( error ) {
		console.error( 'Error fetching task:', error );
		res.status( 500 ).json( { error: 'Internal Server Error' } );
	}
} )
// SEND TO GOOGLE SHEETS
router.get('/google/:weekNumber/:timeInSeconds', requireAuth, async (req, res) => {
	const { weekNumber, timeInSeconds } = req.params;
	const hours = convertMinutesToHours(convertSecondsToMinutes(timeInSeconds));
	console.log(`Week ${weekNumber}, ${hours} hours matched.`);

	const currentYear = new Date().getFullYear();
	const formattedWeekNumber = String(weekNumber).padStart(2, '0');
	const formattedWeek = `${formattedWeekNumber},${currentYear}`;

	try {
		const resultOverall = await connectToSpreadsheet('Overall stats');
		const spreadsheetIdOverall = resultOverall.spreadsheetId;
		let endRowOverall = resultOverall.endRowOverall;
		const sheetsOverall = resultOverall.sheets;

		let nextEmptyRowOverall = endRowOverall + 1;
		let rangeOverall = `'Overall stats'!A${nextEmptyRowOverall}`;

		const requestOverall = {
			spreadsheetId: spreadsheetIdOverall,
			range: rangeOverall,
			valueInputOption: 'RAW',
			resource: {
				values: [[formattedWeek]]
			}
		};

		const responseOverall = await sheetsOverall.spreadsheets.values.update(requestOverall);

		const resultDaily = await connectToSpreadsheet('Daily stats');
		const spreadsheetIdDaily = resultDaily.spreadsheetId;
		let endRowDaily = resultDaily.endRow;
		const sheetsDaily = resultDaily.sheets;

		let nextEmptyRowDaily = endRowDaily + 1;
		let rangeDaily = `'Daily stats'!A${nextEmptyRowDaily}`;

		const requestDaily = {
			spreadsheetId: spreadsheetIdDaily,
			range: rangeDaily,
			valueInputOption: 'RAW',
			resource: {
				values: [[formattedWeek, `${hours}`]]
			}
		};

		const responseDaily = await sheetsDaily.spreadsheets.values.update(requestDaily);

		res.json(responseDaily.data);
	} catch (error) {
		console.error(error);
		res.status(500).send(error.toString());
	}
});
// SEND TO SLACK CHANNEL
router.get( '/slack', requireAuth, async ( req, res ) => {

	const lastWeek = getWeekNumber() - 1;
	const boardId = conf.DAILY_BOARD_ID;
	axios.get( `${ process.env.API_URL }/boards/${ boardId }/${ lastWeek }/seconds`, {
		params: {
			secret: process.env.SECRET_QUERY_PARAM_VALUE
		}
	} ).then( async ( response ) => {
		const timeInSeconds = response.data;
		const minutes = convertSecondsToMinutes( timeInSeconds );
		const hours = convertMinutesToHours( minutes );
		const message = `Week ${ lastWeek }, ${ hours } hours matched.`;
		try {
			await axios.post( process.env.SLACK_WEBHOOK_URL, {
				text: message,
			} );
			res.json( message );
		} catch ( error ) {
			console.error( error );
			res.status( 500 ).send( error.toString() );
		}
	} )
} );

router.get( '/paymo/users/', requireAuth, async ( req, res ) => {
	const users = await getActiveUsersList();
	const weekNumber = 35;
	res.json(users);
	for (const user of users) {
		console.log(`user - ${user.name}`);
		const usersTasks = await getSpendTimeForUser(weekNumber, user.id);
		console.log(usersTasks);
	}
})


export default router;
