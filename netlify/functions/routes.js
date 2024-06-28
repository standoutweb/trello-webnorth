// /netlify/functions/routes.js
import express from 'express';
import Trello from "trello";
import requireAuth from './middlewares/requireAuth';
import { getPaymoAuthHeader } from './utils/auth';
import { getCreatedCardsCount, getLastWeekActionsByIdList } from './controllers/trelloController';
import { getLastWeekBillableHours } from './controllers/paymoController';
import { saveDataToSpreadsheet, connectToSpreadsheet } from './utils/googleSheets';
import {
	convertSecondsToMinutes,
	convertMinutesToHours,
	getWeekNumber,
	includesTrelloLink,
	getStartAndEndDate,
	fetchBoardSeconds, fetchGoogleUpdate
} from './utils/helpers';
import axios from "axios";
import { conf } from "./conf";

const router = express.Router();
const trello = new Trello( process.env.KEY, process.env.TOKEN );
let endRow = 0;

router.use( ( req, res, next ) => {
	res.header( 'Access-Control-Allow-Origin', 'http://localhost:3000' ); // Or '*' for any origin
	res.header( 'Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept' );
	next();
} );
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
		res.json('Please wait')
		const { timeInSeconds: dailyTimeInSeconds, projectIds: dailyProjectIds } = await fetchBoardSeconds(boardId, lastWeek);
		new Promise(resolve => setTimeout(resolve, 4000));
		const { timeInSeconds: doneTimeInSeconds, projectIds: doneProjectIds } = await fetchBoardSeconds(doneBoardId, lastWeek);

		// Sum up time in seconds for both boards
		const totalTimeInSeconds = dailyTimeInSeconds + doneTimeInSeconds;

		console.log('Total Time in seconds:', totalTimeInSeconds);
		console.log('Project IDs:', dailyProjectIds, doneProjectIds)
		const googleResponse = await fetchGoogleUpdate(lastWeek, totalTimeInSeconds);
		console.log('Google response:', googleResponse);

		const excludeProjectIds = conf.EXCLUDED_PAYMO_PROJECTS.split(',').map(Number);
		let uniqueProjectIds = [...new Set([...dailyProjectIds, ...doneProjectIds])];
		uniqueProjectIds = uniqueProjectIds.filter(projectId => !excludeProjectIds.includes(projectId));
		const billableTime = await getLastWeekBillableHours(uniqueProjectIds);
		let billableTimeArray = [billableTime];
		console.log('Billable time:', billableTime);
		await saveDataToSpreadsheet('G', billableTimeArray);

		const tasksMovedToDone = await getLastWeekActionsByIdList(listId);
		let tasksMovedToDoneArray = [tasksMovedToDone];
		await saveDataToSpreadsheet('F', tasksMovedToDoneArray);

		const dailyCreatedCardsCount = await getCreatedCardsCount(lastWeek, boardId);
		new Promise(resolve => setTimeout(resolve, 5000));

		await saveDataToSpreadsheet('C', dailyCreatedCardsCount);

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
	new Promise(resolve => setTimeout(resolve, 1000));

	// Get the current year
	const currentYear = new Date().getFullYear();

	try {
		const result = await connectToSpreadsheet();
		new Promise( resolve => setTimeout( resolve, 2000 ) );
		const spreadsheetId = result.spreadsheetId;
		let endRow = result.endRow;
		const sheets = result.sheets;

		let nextEmptyRow = endRow + 1;
		let range = `Sheet1!A${nextEmptyRow}`;

		// Format weekNumber to have leading zeros if necessary
		const formattedWeekNumber = String(weekNumber).padStart(2, '0');

		// Create the formatted week string
		const formattedWeek = `${formattedWeekNumber},${currentYear}`;

		const request = {
			spreadsheetId,
			range,
			valueInputOption: 'RAW',
			resource: {
				values: [[formattedWeek, `${hours}`]]
			}
		};

		const response = await sheets.spreadsheets.values.update(request);
		res.json(response.data);
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

export default router;
