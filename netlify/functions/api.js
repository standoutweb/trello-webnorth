import express, { Router } from "express";
import serverless from "serverless-http";
import Trello from "trello";
import axios from "axios"; // Ensure axios is installed for making HTTP requests
const { GoogleAuth } = require( 'google-auth-library' );
const { google } = require( 'googleapis' );

const trello = new Trello( process.env.KEY, process.env.TOKEN );
const PAYMO_API_BASE_URL = "https://app.paymoapp.com/api";
const api = express();
const router = Router();


// get current week number
function getWeekNumber( d ) {
	d = new Date( Date.UTC( d.getFullYear(), d.getMonth(), d.getDate() ) );
	d.setUTCDate( d.getUTCDate() + 4 - ( d.getUTCDay() || 7 ) );
	const yearStart = new Date( Date.UTC( d.getUTCFullYear(), 0, 1 ) );
	const weekNo = Math.ceil( ( ( ( d - yearStart ) / 86400000 ) + 1 ) / 7 );
	return weekNo;
}

function getStartAndEndDate( weekNumber ) {
	let date = new Date( new Date().getFullYear(), 0, 1 );
	let dayOfWeek = date.getDay();
	let diff = date.getDate() - dayOfWeek + ( dayOfWeek === 0 ? -6 : 1 );
	let firstMondayOfYear = new Date( date.setDate( diff ) );
	firstMondayOfYear.setDate( firstMondayOfYear.getDate() + ( weekNumber - 1 ) * 7 + 1 );
	let startDate = new Date( firstMondayOfYear );
	let endDate = new Date( startDate );
	endDate.setDate( endDate.getDate() + 6 );
	startDate = startDate.toISOString().split( 'T' )[ 0 ];
	endDate = endDate.toISOString().split( 'T' )[ 0 ];
	return { startDate, endDate };
}

function convertSecondsToHoursMinutes( seconds ) {
	const hours = Math.floor( seconds / 3600 );
	const minutes = Math.floor( ( seconds % 3600 ) / 60 );

	return { hours, minutes };
}

function convertSecondsToMinutes( seconds ) {
	return seconds / 60;
}

function convertMinutesToHours( minutes ) {
	return minutes / 60;
}

function includesTrelloLink( description ) {
	const trelloLinkRegex = /trello.com\/c\/[a-zA-Z0-9]+/g;
	return trelloLinkRegex.test( description );
}

function cardMatchesBoardId( card, boardId ) {
	return card.idBoard === boardId;
}

router.use( ( req, res, next ) => {
	res.header( 'Access-Control-Allow-Origin', 'http://localhost:3000' ); // Or '*' for any origin
	res.header( 'Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept' );
	next();
} );

// Middleware to check for authenticated user
const requireAuth = ( req, res, next ) => {
	// If the secret query parameter is provided and matches the SECRET_QUERY_PARAM_VALUE, bypass the usual authentication
	if ( req.query.secret && req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE ) {
		return next();
	}

	if ( process.env.NODE_ENV === 'development' ) {
		return next();
	}

	if ( ! req.context || ! req.context.clientContext || ! req.context.clientContext.user ) {
		return res.status( 401 ).send( 'Unauthorized' );
	}

	if ( req.query.secret && req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE ) {
		return next();
	}

	next();
};

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
		const cards = await trello.getCardsOnBoard( req.params.boardId );
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

router.get( '/paymo/timelogs', requireAuth, async ( req, res ) => {
	let { startDate, endDate } = req.query;

	// Calculate last week's dates if startDate and endDate are not provided
	if ( ! startDate || ! endDate ) {
		const today = new Date();
		const pastDay = new Date( today.setDate( today.getDate() - today.getDay() - 6 ) ); // Get the date for last week's start (assuming Sunday as the first day of the week)
		const lastWeekStart = new Date( pastDay.setDate( pastDay.getDate() - pastDay.getDay() ) );
		const lastWeekEnd = new Date( lastWeekStart );
		lastWeekEnd.setDate( lastWeekEnd.getDate() + 6 );

		// Format dates as YYYY-MM-DD
		startDate = lastWeekStart.toISOString().split( 'T' )[ 0 ];
		endDate = lastWeekEnd.toISOString().split( 'T' )[ 0 ];
	}

	const username = process.env.PAYMO_API_KEY;
	const password = 'random'; // Use a random password as specified
	const basicAuth = 'Basic ' + Buffer.from( username + ':' + password ).toString( 'base64' );

	try {
		const response = await axios.get( `${ PAYMO_API_BASE_URL }/entries`, {
			headers: { Authorization: basicAuth },
			params: {
				where: `time_interval in ("${ startDate }","${ endDate }")`
			}
		} );
		res.json( response.data );
	} catch ( error ) {
		console.error( error );
		res.status( 500 ).send( error.toString() );
	}
} );

/*
* Get time logs for a specific week number
*/

router.get( '/paymo/timelogs/:weekNumber', requireAuth, async ( req, res ) => {
	const weekNumber = req.params.weekNumber;
	const { startDate, endDate } = getStartAndEndDate( weekNumber );
	const username = process.env.PAYMO_API_KEY;
	const password = 'random'; // Use a random password as specified
	const basicAuth = 'Basic ' + Buffer.from( username + ':' + password ).toString( 'base64' );

	try {
		const response = await axios.get( `${ PAYMO_API_BASE_URL }/entries`, {
			headers: { Authorization: basicAuth },
			params: {
				where: `time_interval in ("${ startDate }","${ endDate }")`
			}
		} );
		res.json( response.data );
	} catch ( error ) {
		console.error( error );
		res.status( 500 ).send( error.toString() );
	}
} );

// SEND TO GOOGLE SHEETS
router.get( '/google/:weekNumber/:timeInSeconds', requireAuth, async ( req, res ) => {
	const timeInSeconds = req.params.timeInSeconds;
	const weekNumber = req.params.weekNumber;
	const minutes = convertSecondsToMinutes( timeInSeconds );
	const hours = convertMinutesToHours( minutes );
	try {
		const credentials = JSON.parse( Buffer.from( process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64' ).toString( 'ascii' ) );
		const auth = new GoogleAuth( {
			credentials: credentials,
			scopes: [ 'https://www.googleapis.com/auth/spreadsheets' ],
		} );
		const client = await auth.getClient();
		const sheets = google.sheets( { version: 'v4', auth: client } );

		const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
		let range = 'Sheet1!A1:ZZZ';
		let dataResponse = await sheets.spreadsheets.values.get( { spreadsheetId, range } );
		let values = dataResponse.data.values;

		if ( ! values || ! values.length ) {
			range = `Sheet1!A1:B1`;
			const titleRequest = {
				spreadsheetId,
				range,
				valueInputOption: 'RAW',
				resource: {
					values: [ [ `Week #`, `Time` ] ]
				}
			};
			const titleResponse = await sheets.spreadsheets.values.update( titleRequest );

			dataResponse = await sheets.spreadsheets.values.get( { spreadsheetId, range } );
			values = dataResponse.data.values;
		}

		let startRow = 1;
		let endRow = values.length;
		while ( endRow > startRow && ! values[ endRow - 1 ].some( cell => cell.trim() !== '' ) ) {
			endRow--;
		}

		let nextEmptyRow = endRow + 1;
		range = `Sheet1!A${ nextEmptyRow }`;
		const request = {
			spreadsheetId,
			range,
			valueInputOption: 'RAW',
			resource: {
				values: [ [ `Week ${ weekNumber }`, `${ hours }` ] ]
			}
		};

		const response = await sheets.spreadsheets.values.update( request );
		res.json( response.data );
	} catch ( error ) {
		console.error( error );
		res.status( 500 ).send( error.toString() );
	}
} );

// SEND TO SLACK CHANNEL
router.get( '/slack', async ( req, res ) => {
	// to do convert this to a function as it is used in multiple places
	const secretToken = process.env.SECRET_QUERY_PARAM_VALUE; // Make sure to store your secret token in your environment variables

	if ( ! req.query.secret || req.query.secret !== secretToken ) {
		return res.status( 401 ).send( 'Unauthorized' );
	}


	const today = new Date();
	const weekNumber = getWeekNumber( today );
	const lastWeek = weekNumber - 1;
	const boardId = process.env.DAILY_BOARD_ID;
	axios.get( `${ process.env.API_URL }/boards/${ boardId }/${ lastWeek }/time-spent`, {
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

// HELPER API ROUTES

// get hours worked on specific week and specific board
router.get( '/boards/:boardId/:weekNumber/time-spent', async ( req, res ) => {
	const { boardId, weekNumber } = req.params;
	const { startDate, endDate } = getStartAndEndDate( weekNumber );

	let secretToken = req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE ? process.env.SECRET_QUERY_PARAM_VALUE : null;

	try {
		// Fetch timelogs and boards/cards data concurrently
		const [ timelogResponse, cardsResponse ] = await Promise.all( [
			axios.get( `${ process.env.API_URL }/paymo/timelogs/${ weekNumber }`, {
				params: { secret: secretToken }
			} ),
			axios.get( `${ process.env.API_URL }/boards/${ boardId }/cards`, {
				params: { secret: secretToken }
			} )
		] );

		let entries = timelogResponse.data.entries;

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

		console.log( entries )

		const matchedEntries = entries.filter( entry => cards.some( card => card.shortLink === entry.shortLink ) );

		const timeInSeconds = matchedEntries.reduce( ( total, entry ) => total + entry.duration, 0 );

		res.json( timeInSeconds );

	} catch ( error ) {
		console.error( error );
		res.status( 500 ).send( error.toString() );
	}
} );

router.get( '/last-week-hours-daily-send-to-sheets', async ( req, res ) => {
	const secretToken = process.env.SECRET_QUERY_PARAM_VALUE; // Make sure to store your secret token in your environment variables

	if ( ! req.query.secret || req.query.secret !== secretToken ) {
		return res.status( 401 ).send( 'Unauthorized' );
	}

	const today = new Date();
	const weekNumber = getWeekNumber( today );
	const lastWeek = weekNumber - 1;
	const boardId = process.env.DAILY_BOARD_ID;
	axios.get( `${ process.env.API_URL }/boards/${ boardId }/${ lastWeek }/time-spent`, {
		params: {
			secret: process.env.SECRET_QUERY_PARAM_VALUE
		}
	} ).then( ( response ) => {
		const timeInSeconds = response.data;
		axios.get( `${ process.env.API_URL }/google/${ lastWeek }/${ timeInSeconds }/`, {
			params: {
				secret: process.env.SECRET_QUERY_PARAM_VALUE
			}
		} ).then( ( response ) => {
			res.json( response.data );
		} );
	} )
} );

api.use( "/api/", router );

exports.handler = serverless( api, {
	request: ( req, event, context ) => {
		req.context = context;
	},
} );
